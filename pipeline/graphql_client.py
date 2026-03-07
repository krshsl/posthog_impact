"""
graphql_client.py — Async GraphQL client for fetching PR data from GitHub.

Fetches all merged PRs on the master branch with their commits, reviews,
and closing issue references in a single batched query per page.

Commit overflow (totalCount > 100) is flagged for local git backfill;
the REST API is never called.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncIterator

import aiohttp

from pipeline.config import (
    BASE_BRANCH,
    BOT_IGNORE_LIST,
    GITHUB_TOKEN,
    GQL_PAGE_SIZE,
    GRAPHQL_ENDPOINT,
    REPO_NAME,
    REPO_OWNER,
)
from pipeline.metrics import is_off_hours
from pipeline.schemas import CommitRecord, IssueRef, PRRecord

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# GraphQL query
# ---------------------------------------------------------------------------

_PR_QUERY = """
query($owner: String!, $repo: String!, $cursor: String, $base: String!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(
      first: %(page_size)d
      after: $cursor
      states: MERGED
      baseRefName: $base
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        author { login }
        createdAt
        mergedAt
        additions
        deletions
        changedFiles
        isDraft
        commits {
          totalCount
          nodes {
            commit {
              oid
              author { user { login } date }
            }
          }
        }
        reviews(first: 1) {
          nodes { createdAt }
        }
        closingIssuesReferences(first: 50) {
          nodes { number author { login } createdAt }
        }
      }
    }
  }
}
""" % {"page_size": GQL_PAGE_SIZE}


# ---------------------------------------------------------------------------
# Helper: hydrate a raw GraphQL node → PRRecord
# ---------------------------------------------------------------------------


def _hydrate_pr(node: dict) -> PRRecord | None:
    """Convert a raw GraphQL PR node into a PRRecord.

    Returns None if the PR should be skipped (bot author, missing data).
    """
    author_node = node.get("author") or {}
    author_login = author_node.get("login", "")

    if not author_login or author_login.lower() in BOT_IGNORE_LIST:
        return None

    # Commits
    commits_data = node.get("commits", {})
    total_commit_count: int = commits_data.get("totalCount", 0)
    needs_backfill = total_commit_count > GQL_PAGE_SIZE

    commits: list[CommitRecord] = []
    for cn in commits_data.get("nodes", []):
        commit = cn.get("commit", {})
        c_author = commit.get("author") or {}
        u = c_author.get("user") or {}
        login = u.get("login", "")
        if login.lower() in BOT_IGNORE_LIST:
            continue
        date_str = c_author.get("date", "")
        off = False
        if date_str:
            try:
                off = is_off_hours(date_str)
            except (ValueError, TypeError):
                pass
        commits.append(CommitRecord(
            oid=commit.get("oid", ""),
            author_login=login,
            date=date_str,
            is_off_hours=off,
        ))

    # First review timestamp
    reviews = node.get("reviews", {}).get("nodes", [])
    reviews_first_at: str | None = reviews[0].get("createdAt") if reviews else None

    # Issues fixed
    issues_fixed: list[IssueRef] = []
    for issue_node in node.get("closingIssuesReferences", {}).get("nodes", []):
        i_author = (issue_node.get("author") or {}).get("login", "")
        issues_fixed.append(IssueRef(
            number=issue_node["number"],
            author_login=i_author,
            created_at=issue_node.get("createdAt", ""),
        ))

    return PRRecord(
        number=node["number"],
        title=node.get("title", ""),
        author_login=author_login,
        created_at=node.get("createdAt", ""),
        merged_at=node.get("mergedAt", ""),
        additions=node.get("additions", 0),
        deletions=node.get("deletions", 0),
        changed_files=node.get("changedFiles", 0),
        is_draft=node.get("isDraft", False),
        commits=commits,
        reviews_first_at=reviews_first_at,
        issues_fixed=issues_fixed,
        needs_commit_backfill=needs_backfill,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def paginate_prs(
    since: datetime,
    until: datetime,
    session: aiohttp.ClientSession | None = None,
) -> AsyncIterator[list[PRRecord]]:
    """Async generator that yields pages of PRRecord objects.

    PRs are fetched in DESC order of `createdAt`. Pagination stops as soon as
    a node's `mergedAt` timestamp is older than `since`.

    Args:
        since:   Lower bound — stop fetching when PRs are older than this.
        until:   Upper bound — skip PRs merged after this (forward-sync guard).
        session: Optional pre-existing aiohttp session; creates one if None.

    Yields:
        Lists of PRRecord objects, one list per GraphQL page.
    """
    own_session = session is None
    if own_session:
        session = aiohttp.ClientSession(
            headers={
                "Authorization": f"Bearer {GITHUB_TOKEN}",
                "Content-Type": "application/json",
            }
        )

    cursor: str | None = None
    has_next = True

    try:
        while has_next:
            variables = {
                "owner": REPO_OWNER,
                "repo": REPO_NAME,
                "cursor": cursor,
                "base": BASE_BRANCH,
            }
            payload = {"query": _PR_QUERY, "variables": variables}

            async with session.post(GRAPHQL_ENDPOINT, json=payload) as resp:
                resp.raise_for_status()
                body = await resp.json()

            errors = body.get("errors")
            if errors:
                raise RuntimeError(f"GraphQL errors: {errors}")

            pr_conn = (
                body["data"]["repository"]["pullRequests"]
            )
            page_info = pr_conn["pageInfo"]
            has_next = page_info["hasNextPage"]
            cursor = page_info.get("endCursor")

            page: list[PRRecord] = []
            stop_early = False

            for node in pr_conn["nodes"]:
                merged_at_str: str = node.get("mergedAt") or ""
                if not merged_at_str:
                    continue

                merged_dt = datetime.fromisoformat(merged_at_str.replace("Z", "+00:00"))

                # Skip PRs merged after `until` (shouldn't happen in DESC, but guard)
                if merged_dt > until:
                    continue

                # Stop once we've gone past `since`
                if merged_dt < since:
                    stop_early = True
                    break

                pr = _hydrate_pr(node)
                if pr is not None:
                    page.append(pr)

            if page:
                yield page
                logger.info("[graphql] fetched page of %d PRs (cursor=%s)", len(page), cursor)

            if stop_early:
                logger.info("[graphql] reached `since` boundary — stopping pagination")
                break

            # Small back-off to be a polite API citizen
            await asyncio.sleep(0.1)

    finally:
        if own_session:
            await session.close()
