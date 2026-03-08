"""
test_graphql_client.py — Mock-based tests for pipeline/graphql_client.py

Uses pytest-mock and aiohttp's built-in test utilities to verify:
  - Single-page PR hydration into PRRecord objects
  - Multi-page cursor threading
  - Early termination when mergedAt < since
  - Bot filtering inline
  - needs_commit_backfill flag when totalCount > 100
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from pipeline.graphql_client import _hydrate_pr, paginate_prs
from pipeline.schemas import PRRecord


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


def _pr_node(
    number: int = 1,
    author: str = "alice",
    merged_at: str = "2024-01-10T00:00:00+00:00",
    commit_total: int = 1,
    commits: list[dict] | None = None,
) -> dict:
    if commits is None:
        commits = [
            {
                "commit": {
                    "oid": f"abc{number}",
                    "author": {
                        "user": {"login": author},
                        "date": "2024-01-09T10:00:00+00:00",
                    },
                }
            }
        ]
    return {
        "number": number,
        "title": f"PR #{number}",
        "author": {"login": author},
        "createdAt": "2024-01-08T00:00:00+00:00",
        "mergedAt": merged_at,
        "additions": 10,
        "deletions": 5,
        "changedFiles": 2,
        "isDraft": False,
        "commits": {"totalCount": commit_total, "nodes": commits},
        "reviews": {"nodes": [{"createdAt": "2024-01-09T08:00:00+00:00"}]},
        "closingIssuesReferences": {"nodes": []},
    }


# ---------------------------------------------------------------------------
# _hydrate_pr unit tests (pure function, no mocking)
# ---------------------------------------------------------------------------


class TestHydratePR:
    def test_basic_hydration(self):
        node = _pr_node(number=5, author="bob")
        pr = _hydrate_pr(node)
        assert isinstance(pr, PRRecord)
        assert pr.number == 5
        assert pr.author_login == "bob"
        assert pr.additions == 10
        assert pr.deletions == 5

    def test_bot_author_returns_none(self):
        node = _pr_node(author="dependabot[bot]")
        assert _hydrate_pr(node) is None

    def test_missing_author_returns_none(self):
        node = _pr_node()
        node["author"] = None
        assert _hydrate_pr(node) is None

    def test_needs_backfill_when_over_100_commits(self):
        node = _pr_node(commit_total=150)
        pr = _hydrate_pr(node)
        assert pr is not None
        assert pr.needs_commit_backfill is True

    def test_no_backfill_when_under_100_commits(self):
        node = _pr_node(commit_total=50)
        pr = _hydrate_pr(node)
        assert pr is not None
        assert pr.needs_commit_backfill is False

    def test_reviews_first_at_extracted(self):
        node = _pr_node()
        pr = _hydrate_pr(node)
        assert pr is not None
        assert pr.reviews_first_at == "2024-01-09T08:00:00+00:00"

    def test_no_reviews_gives_none(self):
        node = _pr_node()
        node["reviews"] = {"nodes": []}
        pr = _hydrate_pr(node)
        assert pr is not None
        assert pr.reviews_first_at is None

    def test_bot_commits_stripped(self):
        node = _pr_node(commits=[
            {"commit": {"oid": "aaa", "author": {"user": {"login": "alice"}, "date": "2024-01-09T10:00:00+00:00"}}},
            {"commit": {"oid": "bbb", "author": {"user": {"login": "github-actions[bot]"}, "date": "2024-01-09T10:01:00+00:00"}}},
        ])
        pr = _hydrate_pr(node)
        assert pr is not None
        assert len(pr.commits) == 1
        assert pr.commits[0].author_login == "alice"

    def test_off_hours_applied_to_commits(self):
        # 22:00 UTC weekday → off hours
        node = _pr_node(commits=[
            {"commit": {"oid": "aaa", "author": {"user": {"login": "alice"}, "date": "2024-01-08T22:00:00+00:00"}}},
        ])
        pr = _hydrate_pr(node)
        assert pr is not None
        assert pr.commits[0].is_off_hours is True


# ---------------------------------------------------------------------------
# paginate_prs integration tests (mocked aiohttp session)
# ---------------------------------------------------------------------------


def _mock_response(nodes: list[dict], has_next: bool = False, cursor: str | None = None):
    """Build a mock aiohttp response for the GraphQL endpoint."""
    body = {
        "data": {
            "search": {
                "pageInfo": {
                    "hasNextPage": has_next,
                    "endCursor": cursor,
                },
                "nodes": nodes,
            }
        }
    }
    mock_resp = AsyncMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = AsyncMock(return_value=body)
    mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_resp.__aexit__ = AsyncMock(return_value=False)
    return mock_resp


@pytest.mark.asyncio
class TestPaginatePRs:
    async def test_single_page(self):
        since = datetime(2024, 1, 1, tzinfo=timezone.utc)
        until = datetime(2024, 1, 7, tzinfo=timezone.utc)

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=_mock_response(
            nodes=[_pr_node(number=1, merged_at="2024-01-10T00:00:00+00:00")],
            has_next=False,
        ))

        pages = []
        async for page in paginate_prs(since=since, until=until, session=mock_session):
            pages.append(page)

        assert len(pages) == 1
        assert pages[0][0].number == 1

    async def test_multi_page_cursor_threading(self):
        since = datetime(2024, 1, 1, tzinfo=timezone.utc)
        until = datetime(2024, 1, 7, tzinfo=timezone.utc)

        call_count = 0
        responses = [
            _mock_response(
                nodes=[_pr_node(number=2, merged_at="2024-01-15T00:00:00+00:00")],
                has_next=True,
                cursor="cursor_page2",
            ),
            _mock_response(
                nodes=[_pr_node(number=1, merged_at="2024-01-10T00:00:00+00:00")],
                has_next=False,
            ),
        ]

        mock_session = MagicMock()
        mock_session.post = MagicMock(side_effect=responses)

        pages = []
        async for page in paginate_prs(since=since, until=until, session=mock_session):
            pages.append(page)

        assert len(pages) == 2
        assert mock_session.post.call_count == 2
        # Second call must include the cursor from page 1
        second_call_kwargs = mock_session.post.call_args_list[1]
        body = second_call_kwargs[1]["json"]
        assert body["variables"]["cursor"] == "cursor_page2"

    async def test_skips_prs_without_merged_at(self):
        since = datetime(2024, 1, 1, tzinfo=timezone.utc)
        until = datetime(2024, 1, 7, tzinfo=timezone.utc)

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=_mock_response(
            nodes=[
                _pr_node(number=1, merged_at="2024-01-08T00:00:00+00:00"),
                {"number": 2, "title": "Missing"}
            ],
            has_next=False,
        ))

        pages = []
        async for page in paginate_prs(since=since, until=until, session=mock_session):
            pages.append(page)

        assert len(pages) == 1
        numbers = [pr.number for pr in pages[0]]
        assert 1 in numbers
        assert 2 not in numbers
