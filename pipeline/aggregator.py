"""
aggregator.py — Post-fetch assembly helpers.

Responsible for:
  - Filtering bot-authored PRs / commits
  - Merging freshly-fetched off-hours flags onto commits that were
    backfilled from local git (which don't carry `is_off_hours` yet)
"""
from __future__ import annotations

from pipeline.config import BOT_IGNORE_LIST
from pipeline.metrics import is_off_hours
from pipeline.schemas import PRRecord


def filter_bots(prs: list[PRRecord], bot_list: frozenset[str] = BOT_IGNORE_LIST) -> list[PRRecord]:
    """Drop PRs whose author is a known bot.

    Also strips any commits within remaining PRs that were authored by bots,
    so the commit list stays clean.

    Args:
        prs:      Unfiltered list of PRRecord objects.
        bot_list: Set of lowercase bot login strings to exclude.

    Returns:
        Filtered list with bot-authored items removed.
    """
    result: list[PRRecord] = []
    for pr in prs:
        if pr.author_login.lower() in bot_list:
            continue
        # Strip bot commits from the PR's commit list
        pr.commits = [
            c for c in pr.commits
            if c.author_login.lower() not in bot_list
        ]
        result.append(pr)
    return result


def apply_off_hours_flags(prs: list[PRRecord]) -> list[PRRecord]:
    """(Re-)compute `is_off_hours` on every commit in every PR.

    This is safe to call multiple times. It is required after
    `git_analyzer.backfill_commits()` because backfilled commits are
    constructed from raw `git log` output and don't carry the flag yet.

    Args:
        prs: List of PRRecord objects (mutated in-place for efficiency).

    Returns:
        The same list, with `is_off_hours` correctly set on all commits.
    """
    for pr in prs:
        for commit in pr.commits:
            try:
                commit.is_off_hours = is_off_hours(commit.date)
            except (ValueError, TypeError):
                # Malformed date — keep existing value (default False)
                pass
    return prs
