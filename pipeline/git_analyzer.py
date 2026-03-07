"""
git_analyzer.py — Local git operations for commit backfill and attribution.

All operations run against a bare treeless clone of PostHog/posthog.
Subprocesses are spawned concurrently via asyncio with a bounded semaphore
to prevent thrashing.

Local git is used for:
  1. Commit backfill  — PRs where GraphQL totalCount > 100
  2. Bug attribution  — who last touched a changed file before this PR
  3. Legacy detection — was the file dormant for > 6 months before this PR
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pipeline.config import GIT_CLONE_DIR, GIT_CONCURRENCY, GIT_REPO_URL
from pipeline.schemas import CommitRecord, PRRecord

logger = logging.getLogger(__name__)

# Semaphore is created lazily per event-loop to avoid cross-loop issues
_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(GIT_CONCURRENCY)
    return _semaphore


# ---------------------------------------------------------------------------
# Clone management
# ---------------------------------------------------------------------------


async def ensure_clone(clone_dir: str = GIT_CLONE_DIR, repo_url: str = GIT_REPO_URL) -> None:
    """Ensure a bare treeless clone exists at `clone_dir`.

    On first run: `git clone --bare --filter=blob:none`
    On subsequent runs: `git fetch --prune` to update refs cheaply.

    Args:
        clone_dir: Local filesystem path for the bare clone.
        repo_url:  Remote URL of the target repository.
    """
    clone_path = Path(clone_dir)
    if clone_path.exists() and (clone_path / "HEAD").exists():
        logger.info("[git] Updating existing clone at %s", clone_dir)
        await _run_git(["fetch", "--prune"], cwd=clone_dir)
    else:
        logger.info("[git] Cloning %s → %s (bare, treeless)", repo_url, clone_dir)
        clone_path.mkdir(parents=True, exist_ok=True)
        await _run_git(
            ["clone", "--bare", "--filter=blob:none", repo_url, str(clone_path)],
            cwd=str(clone_path.parent),
        )


# ---------------------------------------------------------------------------
# Internal subprocess helper
# ---------------------------------------------------------------------------


async def _run_git(args: list[str], cwd: str) -> str:
    """Run a git command and return its stdout as a string.

    Args:
        args: Git sub-command and arguments (without leading "git").
        cwd:  Working directory for the subprocess.

    Returns:
        Decoded stdout, stripped of trailing whitespace.

    Raises:
        RuntimeError if the process exits with a non-zero return code.
    """
    proc = await asyncio.create_subprocess_exec(
        "git", *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        err = stderr.decode(errors="replace").strip()
        raise RuntimeError(f"git {' '.join(args)} failed: {err}")
    return stdout.decode(errors="replace").strip()


# ---------------------------------------------------------------------------
# Commit backfill
# ---------------------------------------------------------------------------


async def backfill_commits(
    merge_commit_oid: str,
    clone_dir: str = GIT_CLONE_DIR,
) -> list[CommitRecord]:
    """Return all commits reachable from `merge_commit_oid` but not its first parent.

    This enumerates the feature-branch commits that were squash/merge-committed
    into master, using:
        git log --format="%H|%aN|%aD" <merge_commit>^1..<merge_commit>

    Args:
        merge_commit_oid: The SHA of the merge commit on master.
        clone_dir:        Path to the bare clone.

    Returns:
        List of CommitRecord objects (is_off_hours NOT set — caller must apply).
    """
    async with _get_semaphore():
        try:
            out = await _run_git(
                [
                    "log",
                    "--format=%H|%aN|%aD",
                    f"{merge_commit_oid}^1..{merge_commit_oid}",
                ],
                cwd=clone_dir,
            )
        except RuntimeError as exc:
            logger.warning("[git] backfill_commits failed for %s: %s", merge_commit_oid, exc)
            return []

    records: list[CommitRecord] = []
    for line in out.splitlines():
        parts = line.split("|", 2)
        if len(parts) != 3:
            continue
        oid, author_login, date_rfc = parts
        records.append(CommitRecord(
            oid=oid.strip(),
            author_login=author_login.strip(),
            date=date_rfc.strip(),
            is_off_hours=False,  # applied by aggregator.apply_off_hours_flags()
        ))
    return records


# ---------------------------------------------------------------------------
# Bug attribution
# ---------------------------------------------------------------------------


async def get_previous_author(
    commit_hash: str,
    file_path: str,
    clone_dir: str = GIT_CLONE_DIR,
) -> str | None:
    """Return the GitHub login of whoever last touched `file_path` before `commit_hash`.

    Runs:
        git log -n 1 --format="%aN" --skip=1 <commit_hash> -- <file_path>

    The `--skip=1` causes git to skip the commit at `commit_hash` itself, so
    we get the *previous* author.

    Args:
        commit_hash: SHA of the PR's merge commit.
        file_path:   Relative path of the file to inspect.
        clone_dir:   Path to the bare clone.

    Returns:
        Author name string, or None if no prior commit exists for this file.
    """
    async with _get_semaphore():
        try:
            out = await _run_git(
                [
                    "log", "-n", "1",
                    "--format=%aN",
                    "--skip=1",
                    commit_hash,
                    "--",
                    file_path,
                ],
                cwd=clone_dir,
            )
        except RuntimeError as exc:
            logger.debug("[git] get_previous_author failed (%s, %s): %s", commit_hash, file_path, exc)
            return None

    return out if out else None


# ---------------------------------------------------------------------------
# Legacy code detection
# ---------------------------------------------------------------------------


async def is_legacy_file(
    commit_hash: str,
    file_path: str,
    clone_dir: str = GIT_CLONE_DIR,
    legacy_months: int = 6,
) -> bool:
    """Return True if `file_path` was dormant for > `legacy_months` before `commit_hash`.

    Runs:
        git log -1 --format="%cI" --skip=1 <commit_hash> -- <file_path>

    Args:
        commit_hash:   SHA of the PR's merge commit.
        file_path:     Relative path of the file.
        clone_dir:     Path to the bare clone.
        legacy_months: Dormancy threshold in months.

    Returns:
        True if the previous modification is older than the threshold.
    """
    async with _get_semaphore():
        try:
            out = await _run_git(
                [
                    "log", "-1",
                    "--format=%cI",
                    "--skip=1",
                    commit_hash,
                    "--",
                    file_path,
                ],
                cwd=clone_dir,
            )
        except RuntimeError as exc:
            logger.debug("[git] is_legacy_file failed (%s, %s): %s", commit_hash, file_path, exc)
            return False

    if not out:
        return False

    try:
        prev_dt = datetime.fromisoformat(out)
    except ValueError:
        return False

    now = datetime.now(tz=timezone.utc)
    threshold = now - timedelta(days=legacy_months * 30)
    return prev_dt.replace(tzinfo=prev_dt.tzinfo or timezone.utc) < threshold


# ---------------------------------------------------------------------------
# Extract changed files from a merge commit
# ---------------------------------------------------------------------------


async def get_changed_files(
    commit_hash: str,
    clone_dir: str = GIT_CLONE_DIR,
) -> list[str]:
    """Return files changed by a merge commit vs its first parent.

    Runs:
        git diff-tree --no-commit-id -r --name-only <commit_hash>

    Args:
        commit_hash: SHA of the merge commit.
        clone_dir:   Path to the bare clone.

    Returns:
        List of relative file paths.
    """
    async with _get_semaphore():
        try:
            out = await _run_git(
                ["diff-tree", "--no-commit-id", "-r", "--name-only", commit_hash],
                cwd=clone_dir,
            )
        except RuntimeError as exc:
            logger.debug("[git] get_changed_files failed (%s): %s", commit_hash, exc)
            return []

    return [line for line in out.splitlines() if line]


# ---------------------------------------------------------------------------
# Orchestrator: annotate all PRs concurrently
# ---------------------------------------------------------------------------


async def analyze_prs_concurrently(
    prs: list[PRRecord],
    clone_dir: str = GIT_CLONE_DIR,
) -> list[PRRecord]:
    """Annotate each PR with `bug_introduced_by`, `legacy_file_count`, and backfilled commits.

    For each PR:
      1. If `needs_commit_backfill`, fetch missing commits from local git.
      2. Determine changed files via `git diff-tree`.
      3. For each changed file (up to 20), query previous author and legacy status.
      4. Set `bug_introduced_by` (majority-vote author across files).
      5. Set `legacy_file_count`.

    All operations run concurrently within the shared semaphore budget.

    Args:
        prs:       List of PRRecord objects to annotate (mutated in-place).
        clone_dir: Path to the bare clone.

    Returns:
        The same list, annotated.
    """
    tasks = [_annotate_pr(pr, clone_dir) for pr in prs]
    await asyncio.gather(*tasks, return_exceptions=True)
    return prs


async def _annotate_pr(pr: PRRecord, clone_dir: str) -> None:
    """Annotate a single PRRecord in-place."""
    # Use the OID of the most recent commit as the merge commit reference
    if not pr.commits:
        return
    merge_oid = pr.commits[0].oid  # GraphQL returns newest first

    # 1. Commit backfill
    if pr.needs_commit_backfill:
        backfilled = await backfill_commits(merge_oid, clone_dir)
        if backfilled:
            # Replace truncated list with full local list
            pr.commits = backfilled
            pr.needs_commit_backfill = False
            logger.debug("[git] backfilled %d commits for PR #%d", len(backfilled), pr.number)

    # 2. Changed files
    files = await get_changed_files(merge_oid, clone_dir)
    # Cap at 20 files to avoid runaway git calls on massive PRs
    files = files[:20]

    if not files:
        return

    # 3. Per-file queries
    author_votes: dict[str, int] = {}
    legacy_count = 0

    author_tasks = [get_previous_author(merge_oid, f, clone_dir) for f in files]
    legacy_tasks = [is_legacy_file(merge_oid, f, clone_dir) for f in files]

    authors, legacy_flags = await asyncio.gather(
        asyncio.gather(*author_tasks, return_exceptions=True),
        asyncio.gather(*legacy_tasks, return_exceptions=True),
    )

    for maybe_author in authors:
        if isinstance(maybe_author, str) and maybe_author:
            author_votes[maybe_author] = author_votes.get(maybe_author, 0) + 1

    for flag in legacy_flags:
        if flag is True:
            legacy_count += 1

    # 4 & 5. Write results
    if author_votes:
        pr.bug_introduced_by = max(author_votes, key=lambda k: author_votes[k])
    pr.legacy_file_count = legacy_count
