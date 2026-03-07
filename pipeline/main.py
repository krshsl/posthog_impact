"""
main.py — CLI entry point for the PostHog Impact data pipeline.

Usage:
    python -m pipeline.main [--window 90] [--output github_data.json.gz] [--dry-run]

The pipeline runs the following steps in order:
  1. Load existing state from disk (if present)
  2. Ensure local bare clone is up-to-date
  3. Bidirectional sync via GraphQL (forward + backward)
  4. Bot filtering + off-hours flag hydration
  5. Concurrent git annotation (bug attribution, legacy code, commit backfill)
  6. Compress and write output (or print dry-run summary)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone

import aiohttp

from pipeline import config
from pipeline.aggregator import apply_off_hours_flags, filter_bots
from pipeline.config import GIT_CLONE_DIR, GIT_REPO_URL, OUTPUT_PATH, DEFAULT_WINDOW_DAYS
from pipeline.exporter import print_dry_run_summary, write_output
from pipeline.git_analyzer import analyze_prs_concurrently, ensure_clone
from pipeline.pr_fetcher import load_state, run_sync
from pipeline.schemas import MetaState, OutputPayload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stderr,
)
logger = logging.getLogger("pipeline.main")

if config.BASE_BRANCH != "master":
    logger.warning(
        "BASE_BRANCH is set to %r in config; overriding to 'master' to enforce master-only runs",
        config.BASE_BRANCH,
    )
    config.BASE_BRANCH = "master"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PostHog Impact data pipeline — fetch, analyze, and compress GitHub metrics."
    )
    parser.add_argument(
        "--window",
        type=int,
        default=DEFAULT_WINDOW_DAYS,
        metavar="DAYS",
        help=f"Rolling window in days (default: {DEFAULT_WINDOW_DAYS})",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=OUTPUT_PATH,
        metavar="PATH",
        help=f"Output file path (default: {OUTPUT_PATH})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Print a summary to stderr without writing any files",
    )
    parser.add_argument(
        "--skip-git",
        action="store_true",
        default=False,
        help="Skip local git annotation (useful for fast iteration / CI debugging)",
    )
    return parser.parse_args()


async def _main(args: argparse.Namespace) -> None:
    if not config.GITHUB_TOKEN:
        logger.error("GITHUB_TOKEN environment variable is not set. Aborting.")
        sys.exit(1)

    now = datetime.now(tz=timezone.utc)
    logger.info("Pipeline started — window=%d days, now=%s", args.window, now.isoformat())

    # -------------------------------------------------------------------
    # Step 1: Load existing state
    # -------------------------------------------------------------------
    existing_payload, meta = load_state(args.output)

    # Override window from CLI
    meta = MetaState(
        last_fetched_at=meta.last_fetched_at,
        earliest_fetched_at=meta.earliest_fetched_at,
        window_days=args.window,
    )

    # -------------------------------------------------------------------
    # Step 2: Ensure local bare clone is ready (runs concurrently with API)
    # -------------------------------------------------------------------
    clone_task: asyncio.Task | None = None
    if not args.skip_git:
        clone_task = asyncio.create_task(
            ensure_clone(clone_dir=GIT_CLONE_DIR, repo_url=GIT_REPO_URL)
        )

    # -------------------------------------------------------------------
    # Step 3: Bidirectional GraphQL sync
    # -------------------------------------------------------------------
    async with aiohttp.ClientSession(
        headers={
            "Authorization": f"Bearer {config.GITHUB_TOKEN}",
            "Content-Type": "application/json",
        }
    ) as session:
        prs, updated_meta = await run_sync(
            existing_payload=existing_payload,
            meta=meta,
            now=now,
            window_days=args.window,
            session=session,
        )

    logger.info("Sync complete: %d PRs in window", len(prs))

    # -------------------------------------------------------------------
    # Step 4: Bot filtering + off-hours hydration
    # -------------------------------------------------------------------
    prs = filter_bots(prs)
    prs = apply_off_hours_flags(prs)
    logger.info("After bot filter: %d PRs", len(prs))

    # -------------------------------------------------------------------
    # Step 5: Concurrent git annotation
    # -------------------------------------------------------------------
    if not args.skip_git:
        if clone_task is not None:
            await clone_task  # ensure clone is ready before git ops
        logger.info("Running git annotation on %d PRs…", len(prs))
        prs = await analyze_prs_concurrently(prs, clone_dir=GIT_CLONE_DIR)
        # Re-apply off-hours after potential commit backfill
        prs = apply_off_hours_flags(prs)
    else:
        logger.info("--skip-git flag set, skipping git annotation")

    # -------------------------------------------------------------------
    # Step 6: Export
    # -------------------------------------------------------------------
    payload = OutputPayload(meta=updated_meta, pull_requests=prs)

    if args.dry_run:
        print_dry_run_summary(payload)
    else:
        write_output(payload, path=args.output)

    logger.info("Pipeline finished successfully")


def main() -> None:
    args = _parse_args()
    asyncio.run(_main(args))


if __name__ == "__main__":
    main()
