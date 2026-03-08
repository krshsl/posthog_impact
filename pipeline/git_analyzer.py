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
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pipeline.config import GIT_CLONE_DIR, GIT_CONCURRENCY, GIT_REPO_URL
from pipeline.schemas import CommitRecord, PRRecord

logger = logging.getLogger(__name__)

# Semaphores are created lazily per event-loop
_git_semaphore: asyncio.Semaphore | None = None
_pr_semaphore: asyncio.Semaphore | None = None

def _get_git_semaphore() -> asyncio.Semaphore:
    global _git_semaphore
    if _git_semaphore is None:
        _git_semaphore = asyncio.Semaphore(GIT_CONCURRENCY)
    return _git_semaphore

def _get_pr_semaphore() -> asyncio.Semaphore:
    global _pr_semaphore
    if _pr_semaphore is None:
        _pr_semaphore = asyncio.Semaphore(20)  # Bound PR-level concurrency (avoid macOS FD limits)
    return _pr_semaphore


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
    async with _get_git_semaphore():
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
# Orchestrator: annotate PRs
# ---------------------------------------------------------------------------


async def analyze_prs_concurrently(
    prs: list[PRRecord],
    clone_dir: str = GIT_CLONE_DIR,
) -> list[PRRecord]:
    """Annotate PRs using a 3-Stage Inverse PR-to-File map streaming architecture.
    
    Stage 1: Calculate Diff-Tree and Backfill commits for all PRs concurrently.
    Stage 2: Build an inverse map (`file -> list[PRRecord]`) for all modified files.
    Stage 3: Stream `git log` backwards in one O(N) pass, natively resolving all attributions
             for all PRs as the files materialize in history.
    """
    total = len(prs)
    if not total:
        return prs

    # -----------------------------------------------------------------------
    # Stage 1: Commit Backfill
    # -----------------------------------------------------------------------
    logger.info("[git] Stage 1: Checking %d PRs for commit backfill (GraphQL overflow)...", total)
    stage1_processed = 0

    async def stage1_pr(pr: PRRecord):
        nonlocal stage1_processed
        async with _get_pr_semaphore():
            try:
                if not pr.commits:
                    return
                
                # Commit backfill
                if pr.needs_commit_backfill:
                    merge_oid = pr.commits[0].oid
                    backfilled = await backfill_commits(merge_oid, clone_dir)
                    if backfilled:
                        pr.commits = backfilled
                        pr.needs_commit_backfill = False
                        
            except Exception as e:
                logger.error("[git] Stage 1 error for PR #%d: %s", pr.number, e)
            finally:
                stage1_processed += 1
                if stage1_processed % 100 == 0 or stage1_processed == total:
                    logger.info("[git] Progress: stage 1 completed %d/%d PRs", stage1_processed, total)

    await asyncio.gather(*(stage1_pr(pr) for pr in prs))

    # -----------------------------------------------------------------------
    # Stage 2: Inverse Map Construction
    # -----------------------------------------------------------------------
    # pending_files: maps file_path -> list of PR objects that need it resolved
    pending_files: dict[str, list[PRRecord]] = {}
    pr_author_votes: dict[int, dict[str, int]] = {pr.number: {} for pr in prs}
    pr_legacy_counts: dict[int, int] = {pr.number: 0 for pr in prs}
    pr_ignore_oids: dict[int, set[str]] = {}

    oldest_merge_dt = None

    for pr in prs:
        pr_ignore_oids[pr.number] = {c.oid for c in pr.commits}
        
        if not pr.merged_at:
            continue
            
        pr_merge_dt = datetime.fromisoformat(pr.merged_at.replace("Z", "+00:00"))
        if oldest_merge_dt is None or pr_merge_dt < oldest_merge_dt:
            oldest_merge_dt = pr_merge_dt

        for f in pr.modified_files:
            if f not in pending_files:
                pending_files[f] = []
            pending_files[f].append(pr)

    if not pending_files:
        return prs

    logger.info("[git] Stage 2: Built inverse map for %d unique files.", len(pending_files))

    # We bound the historical traversal to `oldest PR merge - 2 years`
    # This guarantees we never trace to the dawn of git history for orphaned files
    cutoff_dt = oldest_merge_dt - timedelta(days=365 * 2) if oldest_merge_dt else None

    # -----------------------------------------------------------------------
    # Stage 3: Steaming O(N) Git Log resolution
    # -----------------------------------------------------------------------
    logger.info("[git] Stage 3: Streaming git log backwards to resolve attributions...")
    cmd = [
        "git", "log",
        "--format=commit|%H|%aN|%cI",
        "--name-only",
        "-m",   # Important: also show what files changed in merge commits
        "HEAD"  # We swept all PRs, they are all reachable from master HEAD
    ]
    
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=clone_dir,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    
    current_commit_oid = None
    current_author = None
    current_dt = None
    
    while True:
        line_bytes = await proc.stdout.readline()
        if not line_bytes:
            break
            
        line = line_bytes.decode('utf-8', errors='replace').strip()
        if not line:
            continue
            
        if line.startswith("commit|"):
            parts = line.split("|", 3)
            if len(parts) >= 4:
                current_commit_oid = parts[1].strip()
                current_author = parts[2].strip() or None
                try:
                    current_dt = datetime.fromisoformat(parts[3].strip())
                except ValueError:
                    current_dt = None
                    
            # Check cutoff: abort stream if we've traveled further back in time than necessary
            if current_dt and cutoff_dt and current_dt < cutoff_dt:
                logger.debug("[git] Reached timeline cutoff %s, aborting stream early.", cutoff_dt)
                break
                
        else:
            # It's a file path
            file_path = line
            if file_path in pending_files:
                # Iterate a copy of the set since we may remove elements from it
                prs_needing_file = list(pending_files[file_path])
                for pr in prs_needing_file:
                    
                    # 1. Skip if the commit is part of the PR itself (don't blame ourselves)
                    if current_commit_oid in pr_ignore_oids[pr.number]:
                        continue
                        
                    # 2. Check if the historical commit actually predates the PR's landing
                    pr_merge_dt = datetime.fromisoformat(pr.merged_at.replace("Z", "+00:00"))
                    if current_dt and current_dt <= pr_merge_dt:
                        # Success! Found the previous modification
                        if current_author:
                            pr_author_votes[pr.number][current_author] = pr_author_votes[pr.number].get(current_author, 0) + 1
                        
                        # Check Legacy condition (> 6 months dormant prior to PR)
                        legacy_threshold = pr_merge_dt - timedelta(days=6 * 30)
                        if current_dt < legacy_threshold:
                            pr_legacy_counts[pr.number] += 1
                            
                        # Remove this PR from caring about this file anymore
                        pending_files[file_path].remove(pr)
                        
                # If no PRs care about this file anymore, remove it from inverse map entirely
                if not pending_files[file_path]:
                    del pending_files[file_path]
                    
                # Short-circuit if all files are entirely resolved
                if not pending_files:
                    logger.info("[git] All %d files resolved successfully! Terminating git stream.", len(pending_files))
                    break

    # Cleanup subprocess if we short-circuited
    if proc.returncode is None:
        try:
            proc.terminate()
            await proc.wait()
        except OSError:
            pass

    # Finally, assign the tabulated aggregated results back to the PRs
    for pr in prs:
        votes = pr_author_votes.get(pr.number)
        if votes:
            pr.bug_introduced_by = max(votes, key=lambda k: votes[k])
        pr.legacy_file_count = pr_legacy_counts.get(pr.number, 0)

    return prs
