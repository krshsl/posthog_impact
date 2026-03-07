"""
test_pr_fetcher.py — Unit tests for pipeline/pr_fetcher.py (pure functions only)

We test the deterministic helpers: prune(), merge_prs(), and load_state()
with a non-existent file (no I/O required).
"""
import gzip
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone

import pytest

from pipeline.pr_fetcher import load_state, merge_prs, prune
from pipeline.schemas import CommitRecord, PRRecord


def _make_pr(number: int, merged_at: str) -> PRRecord:
    return PRRecord(
        number=number,
        title=f"PR #{number}",
        author_login="alice",
        created_at="2024-01-01T00:00:00+00:00",
        merged_at=merged_at,
        additions=10,
        deletions=5,
        changed_files=1,
        is_draft=False,
    )


class TestPrune:
    def test_removes_old_prs(self):
        now = datetime(2024, 4, 1, tzinfo=timezone.utc)
        prs = [
            _make_pr(1, "2024-01-01T00:00:00+00:00"),  # 91 days old → pruned
            _make_pr(2, "2024-01-02T00:00:00+00:00"),  # exactly 90 days old → kept (>= cutoff)
            _make_pr(3, "2024-01-03T00:00:00+00:00"),  # 89 days old → kept
        ]
        result = prune(prs, now=now, window_days=90)
        assert [pr.number for pr in result] == [2, 3]

    def test_keeps_all_within_window(self):
        now = datetime(2024, 4, 1, tzinfo=timezone.utc)
        prs = [_make_pr(1, "2024-03-31T00:00:00+00:00")]
        assert len(prune(prs, now=now, window_days=90)) == 1

    def test_empty_list(self):
        now = datetime(2024, 4, 1, tzinfo=timezone.utc)
        assert prune([], now=now, window_days=90) == []

    def test_all_pruned(self):
        now = datetime(2024, 4, 1, tzinfo=timezone.utc)
        prs = [_make_pr(1, "2020-01-01T00:00:00+00:00")]
        assert prune(prs, now=now, window_days=90) == []


class TestMergePRs:
    def test_deduplicates_by_number_incoming_wins(self):
        existing = [_make_pr(1, "2024-01-10T00:00:00+00:00")]
        incoming = [_make_pr(1, "2024-01-11T00:00:00+00:00")]  # newer merged_at
        result = merge_prs(existing, incoming)
        assert len(result) == 1
        assert result[0].merged_at == "2024-01-11T00:00:00+00:00"

    def test_combines_disjoint_sets(self):
        existing = [_make_pr(1, "2024-01-10T00:00:00+00:00")]
        incoming = [_make_pr(2, "2024-01-11T00:00:00+00:00")]
        result = merge_prs(existing, incoming)
        assert len(result) == 2

    def test_sorted_by_merged_at_desc(self):
        existing = [_make_pr(1, "2024-01-08T00:00:00+00:00")]
        incoming = [_make_pr(2, "2024-01-10T00:00:00+00:00")]
        result = merge_prs(existing, incoming)
        assert result[0].number == 2  # newer first

    def test_empty_incoming(self):
        existing = [_make_pr(1, "2024-01-10T00:00:00+00:00")]
        result = merge_prs(existing, [])
        assert len(result) == 1

    def test_empty_existing(self):
        incoming = [_make_pr(1, "2024-01-10T00:00:00+00:00")]
        result = merge_prs([], incoming)
        assert len(result) == 1


class TestLoadState:
    def test_missing_file_returns_none_and_default_meta(self):
        payload, meta = load_state("/tmp/does_not_exist_posthog_test.json.gz")
        assert payload is None
        assert meta.window_days == 90

    def test_loads_existing_file(self):
        data = {
            "meta": {
                "last_fetched_at": "2024-01-10T00:00:00+00:00",
                "earliest_fetched_at": "2024-01-01T00:00:00+00:00",
                "window_days": 30,
            },
            "pull_requests": [
                {
                    "number": 42,
                    "title": "Fix bug",
                    "author_login": "alice",
                    "created_at": "2024-01-08T10:00:00+00:00",
                    "merged_at": "2024-01-09T10:00:00+00:00",
                    "additions": 5,
                    "deletions": 2,
                    "changed_files": 1,
                    "is_draft": False,
                    "commits": [],
                    "issues_fixed": [],
                    "reviews_first_at": None,
                    "bug_introduced_by": None,
                    "legacy_file_count": 0,
                }
            ],
        }
        with tempfile.NamedTemporaryFile(suffix=".json.gz", delete=False) as f:
            tmp_path = f.name
            f.write(gzip.compress(json.dumps(data).encode()))

        try:
            payload, meta = load_state(tmp_path)
            assert payload is not None
            assert len(payload.pull_requests) == 1
            assert payload.pull_requests[0].number == 42
            assert meta.window_days == 30
        finally:
            os.unlink(tmp_path)
