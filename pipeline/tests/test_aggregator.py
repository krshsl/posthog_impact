"""
test_aggregator.py — Unit tests for pipeline/aggregator.py
"""
import pytest

from pipeline.aggregator import apply_off_hours_flags, filter_bots
from pipeline.schemas import CommitRecord, PRRecord


def _make_pr(number: int, author: str, commits: list[CommitRecord] | None = None) -> PRRecord:
    return PRRecord(
        number=number,
        title=f"PR #{number}",
        author_login=author,
        created_at="2024-01-08T10:00:00+00:00",
        merged_at="2024-01-08T12:00:00+00:00",
        additions=10,
        deletions=5,
        changed_files=2,
        is_draft=False,
        commits=commits or [],
    )


def _make_commit(login: str, date: str, is_off_hours: bool = False) -> CommitRecord:
    return CommitRecord(oid="abc123", author_login=login, date=date, is_off_hours=is_off_hours)


class TestFilterBots:
    def test_removes_bot_pr(self):
        prs = [
            _make_pr(1, "real-user"),
            _make_pr(2, "dependabot[bot]"),
            _make_pr(3, "renovate[bot]"),
        ]
        result = filter_bots(prs)
        assert len(result) == 1
        assert result[0].number == 1

    def test_keeps_non_bot_prs(self):
        prs = [_make_pr(1, "alice"), _make_pr(2, "bob")]
        result = filter_bots(prs)
        assert len(result) == 2

    def test_removes_bot_commits_within_pr(self):
        commits = [
            _make_commit("alice", "2024-01-08T10:00:00+00:00"),
            _make_commit("github-actions[bot]", "2024-01-08T10:01:00+00:00"),
        ]
        pr = _make_pr(1, "alice", commits=commits)
        result = filter_bots([pr])
        assert len(result) == 1
        assert len(result[0].commits) == 1
        assert result[0].commits[0].author_login == "alice"

    def test_empty_list(self):
        assert filter_bots([]) == []

    def test_custom_bot_list(self):
        prs = [_make_pr(1, "my-internal-bot"), _make_pr(2, "alice")]
        result = filter_bots(prs, bot_list=frozenset({"my-internal-bot"}))
        assert len(result) == 1
        assert result[0].author_login == "alice"

    def test_case_insensitive_matching(self):
        prs = [_make_pr(1, "Dependabot[bot]")]
        result = filter_bots(prs)
        assert len(result) == 0


class TestApplyOffHoursFlags:
    def test_on_hours_commit(self):
        commits = [_make_commit("alice", "2024-01-08T10:00:00+00:00", is_off_hours=False)]
        pr = _make_pr(1, "alice", commits=commits)
        result = apply_off_hours_flags([pr])
        assert result[0].commits[0].is_off_hours is False

    def test_off_hours_commit_evening(self):
        # 22:00 UTC on a weekday
        commits = [_make_commit("alice", "2024-01-08T22:00:00+00:00", is_off_hours=False)]
        pr = _make_pr(1, "alice", commits=commits)
        result = apply_off_hours_flags([pr])
        assert result[0].commits[0].is_off_hours is True

    def test_weekend_commit(self):
        # 2024-01-13 is Saturday, 10:00 UTC
        commits = [_make_commit("alice", "2024-01-13T10:00:00+00:00", is_off_hours=False)]
        pr = _make_pr(1, "alice", commits=commits)
        result = apply_off_hours_flags([pr])
        assert result[0].commits[0].is_off_hours is True

    def test_malformed_date_does_not_raise(self):
        commits = [_make_commit("alice", "not-a-date", is_off_hours=False)]
        pr = _make_pr(1, "alice", commits=commits)
        # Should not raise; flag stays False
        result = apply_off_hours_flags([pr])
        assert result[0].commits[0].is_off_hours is False

    def test_returns_same_list(self):
        prs = [_make_pr(1, "alice")]
        result = apply_off_hours_flags(prs)
        assert result is prs
