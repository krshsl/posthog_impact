# Engineering Impact Dashboard — Project Prompt

## What I'm Building
An engineering impact dashboard for the PostHog open-source GitHub repository (https://github.com/PostHog/posthog). The dashboard visualises contributor performance metrics derived from GitHub data over a rolling 90-day window.

This is an assignment for Workweave (https://workweave.dev), a company that builds engineering intelligence tools. The goal is to produce a working, hosted, data-driven dashboard — not a mock or prototype.

Link to the question (https://workweave.notion.site/Engineering-Impact-Dashboard-Assignment-305c2d11474d80cfa4d9db7e25683a96).

---

## Tech Stack
- **Frontend:** React + Vite. Use Tailwind + shadcn for UI components. Avoid custom CSS.
- **Backend:** Next.js. This will fetch the `github_data.json`, and cache the data to avoid recalculating the metrics everytime.
- **Data pipeline:** Python script run locally, outputs `github_data.json`.
- **GitHub API:** REST for pagination-heavy fetches, GraphQL for batched PR detail fetches.

---

## Architecture
- The data pipeline is run every day, once a day at 12am UTC. The `github_data.json` contains the data generated in the last 90 days.
- The backend is responsible for the heavy number crunching. This will generate the data that the frontend uses to display the graph/leaderboard. Additionally, it will also generate per person metrics.
- The frontend will display the `ranking` by default, think leetcode ranking page or use this dribble link as reference (https://dribbble.com/shots/24217336-DegensBet-Leaderboard).

---

## Data Pipeline Details

- All data is stored as a flat list.
- Day 1: fetch full 90-day window (ideally done locally)
- Day 2+: read `meta.fetched_at` from existing JSON, fetch only since that timestamp
- Data must consist of the following: time series of all PRs, commits related to the PRs, and issues related to the PRs. The reason they're time series, is to only quantify the impact of the PRs in the last 90 days.
- For bug fixes, we need to identify the issue that was fixed. The user associated with the issue fix is granted a positive score. The user who caused the issue, ideally identified by checking the git blame owner of the deleted line for the fix results in a positive score.
- To perform quick calculations, we will first focus on the prev owner who modified this file, the granular git blame calculation will be done on a later change.
- Add a bot filter to ignore any changes made by bots.
- Ensure all the data is filtered from the master branch only.
---

## Metrics to Implement
All metrics are being checked for PR requests that were made to `master` branch only.

### 1. PR Metrics (per contributor)
Derived from `pull_requests` filtered by `author`.
- PR count in window
- Average additions / deletions per PR
- Average PR size (XS <50 / S <200 / M <500 / L <1000 / XL 1000+  lines)
- Average cycle time in hours (created_at → merged_at)
- Review pass rate (% of PRs with zero revision_cycles)
- Average revision cycles per PR

### 2. Cycle Time Breakdown (per contributor)
Cycles are often directly proportional to the size of the PR. So if a small PR takes a long time to merge, it's a sign of a negative signal. However, if a large PR takes a short time to merge, it's a sign of a positive signal.
- Time to first review: `created_at → first_review_at`
- Time in review: `first_review_at → merged_at`
- Both as averages per author

### 3. PR Impact
This is a positive signal - more issues fixed or new features added = more score.
- Track all issues that were fixed by the user in this PR.
- Feature introduced in PR.

### 4. Bugs Attribution
- Positive signal: user fixed an issue. Identified by checking the user who created the PR to fix the issue.
- Negative signal: user introduced an issue. Identified by checking the user who last modified the file before the issue was created, i.e., last modified before the current PR (ideally).

### 5. Legacy Code
- User who modifies the code that was last modified more than 6 months ago, gets a positive score. This is due to the added cognitive load to understand the code.
- The calculation is as follows: Legacy code deserves some positive impact, but if the code is hot, i.e., modified frequently, then it doesn't deserve as much impact.

### 6. Off-Hours Commits (per contributor)
We want to reward contributors who are active during off-hours.
Derived from `commits[author][]`.
- `is_off_hours` is pre-computed in the fetch stage using the UTC offset embedded in each commit's timestamp — no timezone assumptions made
- Off-hours = before 09:00 or after 18:00 local time, OR weekend

---

### Scoring System
- The scoring system is a weighted sum of all the metrics. The weights are as follows:
  - PR metrics: 15% (ensure we don't provide high score just because the user has made a lot of changes in the PR, this must be weighted and normalized properly in order to ensure a fair contribution. User A can't keep churning in new files one after another, even AI can do it. So this must be calculated properly).
  - Cycle time breakdown: 5%
  - PR impact: 20%
  - Bugs attribution: 25%
  - Legacy code: 20%
  - Off-hours commits: 15%
- Each metric should be normalized to a scale of 0-100, and then the weighted sum should be calculated.

---

## Dashboard UI Requirements

- Leaderboard: This should follow a leetcode style UI. The leaderboard must show the points for each metric.
- (?) must be present on the top right, beside the day selector. The (?) will help the user to understand the reason for each metric.
- Profile based metrics, use shadcn ui for graph components. Allow the user to select the days, it will be the following (90, 60, 30, 15, 7). Based on this the information varies, and the number crunching differs. Ideally we want to show area plots for these metrics. This will be used for the issues introduced, issues fixed, and the new features introduced w.r.t. PR. All data is time series. The points can be shown in a radar chart as we have 6 metrics.
- Add a "?" button to the top right corner of the leaderboard, which will show a modal with the explanation of the metrics and our intention behind it.

---

## General Rubric
- Ensure you follow a concise naming convention, and it is consistent throughout. Either it is for the code, or even for the user to view.
- Follow test driven development.
- Code must be highly modular, even data ingestion pipeline must be modular, so that paralellization and other smart stuff can be introduced with ease.
- Create the schema for each layer, i.e., output generated by data pipeline, frontend schema generated by backend, so that each layer can be developed simulataenously.
