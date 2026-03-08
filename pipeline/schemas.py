"""
schemas.py — Canonical dataclass definitions for all pipeline data structures.

Every layer (fetcher, analyzer, exporter) works with these types.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Atom-level records
# ---------------------------------------------------------------------------


@dataclass
class CommitRecord:
    """A single commit attached to a PR."""
    oid: str                    # Git SHA
    author_login: str           # GitHub login (empty string if unknown)
    date: str                   # ISO 8601 with UTC offset, e.g. "2023-10-15T18:30:00+05:30"
    is_off_hours: bool = False  # Pre-computed in fetch stage


@dataclass
class IssueRef:
    """An issue that was closed/fixed by a PR."""
    number: int
    author_login: str   # Who *opened* the issue (used for attribution)
    created_at: str     # ISO 8601


# ---------------------------------------------------------------------------
# PR-level record
# ---------------------------------------------------------------------------


@dataclass
class PRRecord:
    """A fully hydrated Pull Request with all derived fields."""
    number: int
    title: str
    author_login: str           # Who opened the PR
    created_at: str             # ISO 8601
    merged_at: str              # ISO 8601 — only merged PRs are tracked
    additions: int
    deletions: int
    changed_files: int
    is_draft: bool

    commits: list[CommitRecord] = field(default_factory=list)
    modified_files: list[str] = field(default_factory=list)
    reviews_first_at: Optional[str] = None   # ISO 8601 of earliest review event

    # Closed issues resolved by this PR
    issues_fixed: list[IssueRef] = field(default_factory=list)

    # Bug attribution — login of whoever last touched the changed files
    # before this PR (populated by git_analyzer)
    bug_introduced_by: Optional[str] = None

    # Weighted "maintenance" score for files touched by this PR (populated by git_analyzer)
    maintenance_score: float = 0.0

    # Flag set by graphql_client when totalCount > 100; cleared by git_analyzer
    needs_commit_backfill: bool = False

    def to_dict(self) -> dict:
        return {
            "number": self.number,
            "title": self.title,
            "author_login": self.author_login,
            "created_at": self.created_at,
            "merged_at": self.merged_at,
            "additions": self.additions,
            "deletions": self.deletions,
            "changed_files": self.changed_files,
            "modified_files": self.modified_files,
            "is_draft": self.is_draft,
            "commits": [
                {
                    "oid": c.oid,
                    "author_login": c.author_login,
                    "date": c.date,
                    "is_off_hours": c.is_off_hours,
                }
                for c in self.commits
            ],
            "reviews_first_at": self.reviews_first_at,
            "issues_fixed": [
                {
                    "number": i.number,
                    "author_login": i.author_login,
                    "created_at": i.created_at,
                }
                for i in self.issues_fixed
            ],
            "bug_introduced_by": self.bug_introduced_by,
            "maintenance_score": self.maintenance_score,
        }


# ---------------------------------------------------------------------------
# Pipeline state / output envelope
# ---------------------------------------------------------------------------


@dataclass
class MetaState:
    """Bidirectional sync watermarks stored inside github_data.json.gz."""
    last_fetched_at: str      # ISO 8601 — upper bound of last run
    earliest_fetched_at: str  # ISO 8601 — oldest PR we currently hold
    window_days: int          # Rolling window size (e.g. 90)

    def to_dict(self) -> dict:
        return {
            "last_fetched_at": self.last_fetched_at,
            "earliest_fetched_at": self.earliest_fetched_at,
            "window_days": self.window_days,
        }


@dataclass
class OutputPayload:
    """Root envelope written to github_data.json.gz."""
    meta: MetaState
    pull_requests: list[PRRecord] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "meta": self.meta.to_dict(),
            "pull_requests": [pr.to_dict() for pr in self.pull_requests],
        }
