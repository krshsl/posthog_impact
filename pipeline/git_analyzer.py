"""
git_analyzer.py; Local git operations for commit backfill and attribution.

All operations run against a bare treeless clone of PostHog/posthog.
Subprocesses spawn concurrently via asyncio.

Local git provides:
  1. Commit backfill; PRs where GraphQL totalCount > 100
  2. Bug attribution; identifies the author who last touched a file
  3. Legacy detection; detects dormant files > 6 months
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from pipeline.config import GIT_CLONE_DIR, GIT_CONCURRENCY, GIT_REPO_URL
from pipeline.schemas import CommitRecord, PRRecord

logger = logging.getLogger(__name__)

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
        _pr_semaphore = asyncio.Semaphore(20)
    return _pr_semaphore


# ---------------------------------------------------------------------------
# Clone management
# ---------------------------------------------------------------------------


async def ensure_clone(clone_dir: str = GIT_CLONE_DIR, repo_url: str = GIT_REPO_URL) -> None:
    """
    Ensure a bare treeless clone exists at clone_dir.

    The script executes 'git clone --bare --filter=blob:none' on first run.
    Subsequent runs execute 'git fetch --prune' to update refs.
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
    """
    Run a git command and return stdout as a string.

    The function raises a RuntimeError if the process fails.
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
    """
    Return commits reachable from merge_commit_oid but not its first parent.

    The git log command enumerates feature branch commits.
    The caller must apply the is_off_hours flag.
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
            is_off_hours=False,
        ))
    return records


# ---------------------------------------------------------------------------
# Orchestrator: annotate PRs
# ---------------------------------------------------------------------------


async def analyze_prs_concurrently(
    prs: list[PRRecord],
    clone_dir: str = GIT_CLONE_DIR,
) -> list[PRRecord]:
    """
    Annotate PRs using a memory-mapped historical timeline.
    
    Stage 1 backfills commits concurrently.
    Stage 2 builds a complete repository file timeline in one Git pass.
    Stage 3 evaluates PRs against the Python timeline array.
    """
    total = len(prs)
    if not total:
        return prs

    logger.info("[git] Stage 1: Checking %d PRs for commit backfill...", total)
    stage1_processed = 0

    async def stage1_pr(pr: PRRecord):
        nonlocal stage1_processed
        async with _get_pr_semaphore():
            try:
                if not pr.commits:
                    return
                
                if pr.needs_commit_backfill:
                    merge_oid = getattr(pr, 'merge_commit_oid', None) or pr.commits[0].oid
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

    logger.info("[git] Stage 2: Building full repository file timeline in memory...")
    cmd = [
        "git", "log",
        "--reverse",
        "--format=commit|%cI|%aN",
        "--name-only",
        "HEAD"
    ]
    
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=clone_dir,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    
    file_history: dict[str, list[tuple[float, str]]] = defaultdict(list)
    current_ts = 0.0
    current_author = "Unknown"
    
    while True:
        line_bytes = await proc.stdout.readline()
        if not line_bytes:
            break
            
        line = line_bytes.decode('utf-8', errors='replace').strip()
        if not line:
            continue
            
        if line.startswith("commit|"):
            parts = line.split("|", 2)
            if len(parts) == 3:
                try:
                    dt = datetime.fromisoformat(parts[1].strip().replace("Z", "+00:00"))
                    current_ts = dt.timestamp()
                except ValueError:
                    current_ts = 0.0
                current_author = parts[2].strip() or "Unknown"
            continue
            
        if current_ts > 0.0:
            file_history[line].append((current_ts, current_author))
            
    if proc.returncode is None:
        try:
            proc.terminate()
            await proc.wait()
        except OSError:
            pass

    logger.info("[git] Stage 3: Evaluating PRs against the historical timeline...")

    for pr in prs:
        target_time_str = getattr(pr, 'created_at', None) or getattr(pr, 'merged_at', None)
        if not target_time_str:
            continue
            
        try:
            pr_dt = datetime.fromisoformat(target_time_str.replace("Z", "+00:00"))
            cutoff_ts = pr_dt.timestamp()
        except ValueError:
            continue
            
        votes: dict[str, int] = {}
        score = 0.0
        
        for f in pr.modified_files:
            events = file_history.get(f, [])
            
            # Extract state strictly before the PR existed
            prior_events = [e for e in events if e[0] < cutoff_ts]
            count = len(prior_events)
            
            if count == 0:
                continue
                
            if count <= 2:
                score += 2.0
                
            last_ts, last_author = prior_events[-1]
            votes[last_author] = votes.get(last_author, 0) + 1
            
            diff_days = (cutoff_ts - last_ts) / 86400.0
            if diff_days >= 730:
                score += 3.0
            elif diff_days >= 365:
                score += 2.0
            elif diff_days >= 180:
                score += 1.0
                
        if votes:
            pr.bug_introduced_by = max(votes, key=lambda k: votes[k])
        pr.maintenance_score = score

    return prs