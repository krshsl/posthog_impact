"""
metrics.py — Pure, side-effect-free computation helpers.

No I/O. All functions are deterministic based on their inputs, making
them trivially unit-testable without mocking.
"""
from __future__ import annotations

from datetime import datetime


def is_off_hours(date_str: str) -> bool:
    """Return True if the commit was authored outside normal working hours.

    Uses the UTC offset embedded in the ISO 8601 timestamp so that the
    author's *local* hour is checked — no external timezone lookups required.

    Off-hours definition:
      - Any Saturday or Sunday, OR
      - Weekday before 09:00 or from 18:00 onward (local time)

    Args:
        date_str: ISO 8601 string with a UTC offset, e.g. "2023-10-15T18:30:00+05:30".

    Returns:
        True if the commit was authored off-hours.
    """
    dt = datetime.fromisoformat(date_str)
    # weekday() == 5 → Saturday, 6 → Sunday
    if dt.weekday() >= 5:
        return True
    local_hour = dt.hour
    return local_hour < 9 or local_hour >= 18


def pr_size_label(additions: int, deletions: int) -> str:
    """Classify a PR by total lines changed.

    Buckets:
      XS  < 50 lines
      S   < 200 lines
      M   < 500 lines
      L   < 1 000 lines
      XL  ≥ 1 000 lines

    Args:
        additions: Lines added.
        deletions: Lines deleted.

    Returns:
        One of "XS", "S", "M", "L", "XL".
    """
    total = additions + deletions
    if total < 50:
        return "XS"
    if total < 200:
        return "S"
    if total < 500:
        return "M"
    if total < 1000:
        return "L"
    return "XL"


def cycle_time_hours(created_at: str, merged_at: str) -> float:
    """Compute PR cycle time in fractional hours.

    Args:
        created_at: ISO 8601 creation timestamp.
        merged_at:  ISO 8601 merge timestamp.

    Returns:
        Number of hours between creation and merge (always non-negative).
    """
    dt_created = datetime.fromisoformat(created_at)
    dt_merged = datetime.fromisoformat(merged_at)
    delta = dt_merged - dt_created
    return max(0.0, delta.total_seconds() / 3600)


def time_to_first_review_hours(created_at: str, first_review_at: str | None) -> float | None:
    """Compute hours from PR creation to first review event.

    Returns:
        Float hours, or None if no review event exists.
    """
    if first_review_at is None:
        return None
    dt_created = datetime.fromisoformat(created_at)
    dt_review = datetime.fromisoformat(first_review_at)
    delta = dt_review - dt_created
    return max(0.0, delta.total_seconds() / 3600)


def time_in_review_hours(first_review_at: str | None, merged_at: str) -> float | None:
    """Compute hours from first review to merge.

    Returns:
        Float hours, or None if no review event exists.
    """
    if first_review_at is None:
        return None
    dt_review = datetime.fromisoformat(first_review_at)
    dt_merged = datetime.fromisoformat(merged_at)
    delta = dt_merged - dt_review
    return max(0.0, delta.total_seconds() / 3600)
