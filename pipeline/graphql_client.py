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

import re

COMMIT_PAGE_SIZE: int = 100

_PR_QUERY = """
query($query: String!, $cursor: String) {
    search(query: $query, type: ISSUE, first: %(page_size)d, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
            ... on PullRequest {
                number
                title
                author { login }
                createdAt
                mergedAt
                additions
                deletions
                changedFiles
                isDraft
                headRefName
                files(first: 100) {
                    nodes {
                        path
                        changeType
                    }
                }
                commits(first: %(commit_page_size)d) {
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
            }
        }
    }
}
""" % {"page_size": GQL_PAGE_SIZE, "commit_page_size": COMMIT_PAGE_SIZE}


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
    # The GraphQL commits list was requested with a fixed page size
    # (COMMIT_PAGE_SIZE). If totalCount exceeds that, we need a local
    # git backfill to obtain the full commit list.
    needs_backfill = total_commit_count > COMMIT_PAGE_SIZE

    commits: list[CommitRecord] = []
    for cn in commits_data.get("nodes", []):
        commit = cn.get("commit", {})
        c_author = commit.get("author") or {}
        u = c_author.get("user") or {}
        login = (u.get("login") or "")
        if login and login.lower() in BOT_IGNORE_LIST:
            continue
        date_str = c_author.get("date", "")
        off = False
        if date_str:
            try:
                off = is_off_hours(date_str)
            except (ValueError, TypeError):
                # Keep default False on parse error
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

    # Issues fixed via headRefName regex
    issues_fixed: list[IssueRef] = []
    head_ref = node.get("headRefName", "")
    if head_ref:
        # Look for numbers that look like issue numbers (e.g. 1234-fix, issue/1234, etc)
        match = re.search(r'(?:^|/|issue/|bug/|fix/|#)(\d{3,5})(?:-|$)', head_ref)
        if match:
            # We don't have the issue author/createdAt from headRefName, set defaults
            issues_fixed.append(IssueRef(
                number=int(match.group(1)),
                author_login="",
                created_at="",
            ))

    # Files
    modified_files: list[str] = []
    files_data = node.get("files", {})
    for fn in files_data.get("nodes", []):
        if not fn:
            continue
        path = fn.get("path")
        change_type = fn.get("changeType")
        if path and change_type != "ADDED":
            modified_files.append(path)

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
        modified_files=modified_files,
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

    try:
        from datetime import timedelta
        interval_days = 7
        
        # Build the base query string
        bot_filters = " ".join([f"-author:{b}" for b in BOT_IGNORE_LIST])
        base_query_str = f"repo:{REPO_OWNER}/{REPO_NAME} is:pr is:merged base:{BASE_BRANCH} {bot_filters}"
        
        current_since = since
        while current_since < until:
            current_until = min(current_since + timedelta(days=interval_days), until)
            
            # Format times exactly as GitHub expects (e.g. 2024-01-01T00:00:00Z)
            # We need to make sure we use UTC representation
            s_str = current_since.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            u_str = current_until.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            query_str = f"{base_query_str} merged:{s_str}..{u_str}"
            
            logger.info("[graphql] Fetching interval: %s to %s", s_str, u_str)
            
            cursor: str | None = None
            has_next = True

            while has_next:
                variables = {
                    "query": query_str,
                    "cursor": cursor,
                }
                payload = {"query": _PR_QUERY, "variables": variables}

                for attempt in range(3):
                    try:
                        async with session.post(GRAPHQL_ENDPOINT, json=payload, timeout=60) as resp:
                            resp.raise_for_status()
                            body = await resp.json()
                        break
                    except (asyncio.TimeoutError, TimeoutError, aiohttp.ClientError) as e:
                        if attempt == 2:
                            raise
                        logger.warning("[graphql] Request failed (%s), retrying in %d seconds...", type(e).__name__, 2 ** attempt)
                        await asyncio.sleep(2 ** attempt)

                errors = body.get("errors")
                if errors:
                    raise RuntimeError(f"GraphQL errors: {errors}")

                search_conn = body["data"]["search"]
                page_info = search_conn["pageInfo"]
                has_next = page_info["hasNextPage"]
                cursor = page_info.get("endCursor")

                page: list[PRRecord] = []
                for node in search_conn.get("nodes", []):
                    # In search results, empty nodes might appear if not a PullRequest
                    if not node or "mergedAt" not in node:
                        continue
                    
                    pr = _hydrate_pr(node)
                    if pr is not None:
                        page.append(pr)

                if page:
                    yield page
                    logger.info("[graphql] fetched page of %d PRs (cursor=%s)", len(page), cursor)

                # Small back-off to be a polite API citizen
                await asyncio.sleep(0.1)
                
            current_since = current_until
            
    finally:
        if own_session:
            await session.close()
