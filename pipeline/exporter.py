"""
exporter.py — Serialize and compress the final OutputPayload.

Writes github_data.json.gz to disk.  In dry-run mode, prints a
human-readable summary to stdout instead.
"""
from __future__ import annotations

import gzip
import json
import sys

from pipeline.schemas import OutputPayload


def write_output(payload: OutputPayload, path: str) -> None:
    """Serialize `payload` to JSON and write a gzip-compressed file.

    Args:
        payload: The fully assembled output payload.
        path:    Destination file path (e.g. "github_data.json.gz").
    """
    data = json.dumps(payload.to_dict(), separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(data)
    pr_count = len(payload.pull_requests)
    size_kb = len(data) / 1024
    print(f"[exporter] Wrote {pr_count} PRs — uncompressed {size_kb:.1f} KB → {path}")


def print_dry_run_summary(payload: OutputPayload) -> None:
    """Print a human-readable pipeline summary without writing any files.

    Args:
        payload: The fully assembled output payload.
    """
    prs = payload.pull_requests
    meta = payload.meta
    authors = {pr.author_login for pr in prs}
    off_hours_commits = sum(
        1 for pr in prs for c in pr.commits if c.is_off_hours
    )
    total_commits = sum(len(pr.commits) for pr in prs)
    bug_attributions = sum(1 for pr in prs if pr.bug_introduced_by)
    legacy_prs = sum(1 for pr in prs if pr.legacy_file_count > 0)

    lines = [
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  DRY-RUN SUMMARY (nothing written to disk)",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"  Window:            {meta.window_days} days",
        f"  Earliest PR:       {meta.earliest_fetched_at}",
        f"  Last fetched:      {meta.last_fetched_at}",
        f"  PRs:               {len(prs)}",
        f"  Unique authors:    {len(authors)}",
        f"  Total commits:     {total_commits}",
        f"  Off-hours commits: {off_hours_commits}",
        f"  Bug attributions:  {bug_attributions}",
        f"  Legacy file PRs:   {legacy_prs}",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
    ]
    print("\n".join(lines), file=sys.stderr)
