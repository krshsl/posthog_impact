"""
pr_fetcher.py — Bidirectional sync orchestrator.

Manages the rolling 90-day window:
  - Forward sync: fetch new PRs since last_fetched_at
  - Backward sync: extend backward if window has grown
  - Pruning: drop PRs that have aged out of the window
  - Merge / deduplication of new PRs into the existing dataset
"""
from __future__ import annotations

import asyncio

import gzip
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import aiohttp

from pipeline.config import DEFAULT_WINDOW_DAYS
from pipeline.graphql_client import paginate_prs
from pipeline.schemas import MetaState, OutputPayload, PRRecord

logger = logging.getLogger(__name__)

# Sentinel: oldest representable datetime used when no prior data exists
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------


def load_state(path: str) -> tuple[OutputPayload | None, MetaState]:
    """Load existing pipeline output from a gzip-compressed JSON file.

    Args:
        path: Path to github_data.json.gz

    Returns:
        A tuple of (OutputPayload | None, MetaState).
        If the file doesn't exist, returns (None, default MetaState).
    """
    file = Path(path)
    if not file.exists():
        logger.info("[fetcher] No existing state at %s  starting fresh", path)
        now_str = datetime.now(tz=timezone.utc).isoformat()
        return None, MetaState(
            last_fetched_at=now_str,
            earliest_fetched_at=now_str,
            window_days=DEFAULT_WINDOW_DAYS,
        )

    # Stream-read the gzip file into memory once and parse JSON. This avoids
    # an extra decode/encode step and is slightly faster for large payloads.
    with gzip.open(path, "rt", encoding="utf-8") as f:
        raw = json.load(f)

    meta_raw = raw.get("meta", {})
    meta = MetaState(
        last_fetched_at=meta_raw.get("last_fetched_at", _EPOCH.isoformat()),
        earliest_fetched_at=meta_raw.get("earliest_fetched_at", _EPOCH.isoformat()),
        window_days=meta_raw.get("window_days", DEFAULT_WINDOW_DAYS),
    )

    prs: list[PRRecord] = []
    from pipeline.schemas import CommitRecord, IssueRef  # local import to avoid circularity
    for pr_raw in raw.get("pull_requests", []):
        commits = [
            CommitRecord(
                oid=c["oid"],
                author_login=c["author_login"],
                date=c["date"],
                is_off_hours=c.get("is_off_hours", False),
            )
            for c in pr_raw.get("commits", [])
        ]
        issues = [
            IssueRef(
                number=i["number"],
                author_login=i["author_login"],
                created_at=i["created_at"],
            )
            for i in pr_raw.get("issues_fixed", [])
        ]
        prs.append(PRRecord(
            number=pr_raw["number"],
            title=pr_raw.get("title", ""),
            author_login=pr_raw["author_login"],
            created_at=pr_raw["created_at"],
            merged_at=pr_raw["merged_at"],
            additions=pr_raw.get("additions", 0),
            deletions=pr_raw.get("deletions", 0),
            changed_files=pr_raw.get("changed_files", 0),
            is_draft=pr_raw.get("is_draft", False),
            commits=commits,
            modified_files=pr_raw.get("modified_files", []),
            reviews_first_at=pr_raw.get("reviews_first_at"),
            issues_fixed=issues,
            bug_introduced_by=pr_raw.get("bug_introduced_by"),
            legacy_file_count=pr_raw.get("legacy_file_count", 0),
        ))

    payload = OutputPayload(meta=meta, pull_requests=prs)
    logger.info("[fetcher] Loaded %d PRs from existing state", len(prs))
    return payload, meta


# ---------------------------------------------------------------------------
# Sync helpers
# ---------------------------------------------------------------------------


async def forward_sync(
    since: datetime,
    until: datetime,
    session: aiohttp.ClientSession | None = None,
) -> list[PRRecord]:
    """Fetch all PRs merged between `since` and `until`.

    Args:
        since:   Lower bound (exclusive).
        until:   Upper bound (inclusive).
        session: Optional shared aiohttp session.

    Returns:
        Flat list of PRRecord objects.
    """
    logger.info("[fetcher] Forward sync: %s → %s", since.isoformat(), until.isoformat())
    prs: list[PRRecord] = []
    async for page in paginate_prs(since=since, until=until, session=session):
        prs.extend(page)
    logger.info("[fetcher] Forward sync complete: %d PRs fetched", len(prs))
    return prs


async def backward_sync(
    earliest_fetched_at: datetime,
    target_earliest: datetime,
    session: aiohttp.ClientSession | None = None,
) -> list[PRRecord]:
    """Fetch PRs between `target_earliest` and `earliest_fetched_at`.

    Called when the window has expanded and we need to backfill older data.

    Args:
        earliest_fetched_at: The oldest PR timestamp we currently hold.
        target_earliest:     The new oldest bound we need to reach.
        session:             Optional shared aiohttp session.

    Returns:
        Flat list of PRRecord objects to merge into existing data.
    """
    if target_earliest >= earliest_fetched_at:
        logger.info("[fetcher] No backward sync needed")
        return []

    logger.info(
        "[fetcher] Backward sync: %s → %s",
        target_earliest.isoformat(),
        earliest_fetched_at.isoformat(),
    )
    prs: list[PRRecord] = []
    async for page in paginate_prs(
        since=target_earliest,
        until=earliest_fetched_at,
        session=session,
    ):
        prs.extend(page)
    logger.info("[fetcher] Backward sync complete: %d PRs fetched", len(prs))
    return prs


# ---------------------------------------------------------------------------
# Merge / prune
# ---------------------------------------------------------------------------


def merge_prs(existing: list[PRRecord], incoming: list[PRRecord]) -> list[PRRecord]:
    """Merge two PR lists, deduplicating by PR number.

    In case of collision, the incoming record wins (more up-to-date).

    Args:
        existing: Current dataset.
        incoming: Freshly fetched PRs.

    Returns:
        Merged list ordered by `merged_at` DESC.
    """
    by_number: dict[int, PRRecord] = {pr.number: pr for pr in existing}
    for pr in incoming:
        by_number[pr.number] = pr  # incoming wins

    merged = list(by_number.values())
    merged.sort(key=lambda pr: pr.merged_at, reverse=True)
    logger.info("[fetcher] Merged dataset: %d PRs total", len(merged))
    return merged


def prune(prs: list[PRRecord], now: datetime, window_days: int) -> list[PRRecord]:
    """Drop PRs whose `merged_at` is older than `now - window_days`.

    Args:
        prs:         Full PR list.
        now:         Reference "current" time (UTC).
        window_days: Rolling window size.

    Returns:
        Filtered list.
    """
    cutoff = now - timedelta(days=window_days)
    before = len(prs)
    # Build a new list but avoid repeated replace() calls by parsing once per PR
    kept: list[PRRecord] = []
    for pr in prs:
        try:
            merged_dt = datetime.fromisoformat(pr.merged_at.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            # If merged_at is malformed, conservatively keep the PR
            kept.append(pr)
            continue
        if merged_dt >= cutoff:
            kept.append(pr)
    pruned = before - len(kept)
    if pruned:
        logger.info("[fetcher] Pruned %d PRs outside %d-day window", pruned, window_days)
    return kept


# ---------------------------------------------------------------------------
# High-level orchestrator
# ---------------------------------------------------------------------------


async def run_sync(
    existing_payload: OutputPayload | None,
    meta: MetaState,
    now: datetime,
    window_days: int,
    session: aiohttp.ClientSession | None = None,
) -> tuple[list[PRRecord], list[PRRecord], MetaState]:
    """Orchestrate bidirectional sync and pruning.

    Args:
        existing_payload: Existing data (or None on first run).
        meta:             Current MetaState watermarks.
        now:              Reference timestamp (UTC).
        window_days:      Rolling window size.
        session:          Optional shared aiohttp session.

    Returns:
        Tuple of (pruned PR list, list of new PRs needing git analysis, updated MetaState).
    """
    existing_prs = existing_payload.pull_requests if existing_payload else []
    target_earliest = now - timedelta(days=window_days)

    last_dt = datetime.fromisoformat(meta.last_fetched_at.replace("Z", "+00:00"))
    earliest_dt = datetime.fromisoformat(meta.earliest_fetched_at.replace("Z", "+00:00"))

    new_forward, new_backward = await asyncio.gather(
        forward_sync(since=last_dt, until=now, session=session),
        backward_sync(
            earliest_fetched_at=earliest_dt,
            target_earliest=target_earliest,
            session=session,
        ),
    )

    all_new = new_forward + new_backward
    merged = merge_prs(existing_prs, all_new)
    pruned = prune(merged, now=now, window_days=window_days)

    updated_meta = MetaState(
        last_fetched_at=now.isoformat(),
        earliest_fetched_at=target_earliest.isoformat(),
        window_days=window_days,
    )
    return pruned, all_new, updated_meta

