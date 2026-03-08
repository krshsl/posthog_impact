"""
config.py — Global constants, env-var bindings, and tunable parameters.
"""
from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# GitHub target
# ---------------------------------------------------------------------------

REPO_OWNER: str = "PostHog"
REPO_NAME: str = "posthog"
BASE_BRANCH: str = "master"

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

GITHUB_TOKEN: str = os.environ.get("GITHUB_TOKEN", "")

# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

GRAPHQL_ENDPOINT: str = "https://api.github.com/graphql"

# ---------------------------------------------------------------------------
# Bot ignore list
# Any PR/commit whose author login is in this set will be dropped entirely.
# ---------------------------------------------------------------------------

BOT_IGNORE_LIST: frozenset[str] = frozenset(
    {
        "dependabot[bot]",
        "dependabot",
        "github-actions[bot]",
        "renovate[bot]",
        "renovate",
        "posthog-bot",
        "posthog-contributions-bot",
        "semantic-release-bot",
        "snyk-bot",
        "codecov[bot]",
        "stale[bot]",
        "mendral-app",
        "posthog-js-upgrader",
        "clickhouse-sync-posthog",
        "copilot-swe-agent",
        "posthog",
        "hedgehog-bot",
        "posthog-vitals-bot",
        "posthog-js-auto-release-bot",
        "vercel[bot]",
        "mergify[bot]",
        "sentry[bot]",
        "scheduled-actions-posthog",
        "inkeep",
    }
)

# ---------------------------------------------------------------------------
# Pipeline tuning
# ---------------------------------------------------------------------------

DEFAULT_WINDOW_DAYS: int = 90

# GraphQL page size (max 100)
GQL_PAGE_SIZE: int = 100

# Maximum concurrent git subprocess calls
GIT_CONCURRENCY: int = 64

# ---------------------------------------------------------------------------
# Filesystem
# ---------------------------------------------------------------------------

OUTPUT_PATH: str = "github_data.json.gz"
GIT_CLONE_DIR: str = "/tmp/posthog_bare"
GIT_REPO_URL: str = f"https://github.com/{REPO_OWNER}/{REPO_NAME}.git"
