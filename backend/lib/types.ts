// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Output Schema (github_data.json.gz)
// ─────────────────────────────────────────────────────────────────────────────

export type PRSize = "XS" | "S" | "M" | "L" | "XL";

export interface Commit {
  sha: string;
  /** ISO 8601 with UTC offset embedded, e.g. "2024-11-01T14:30:00+05:30" */
  authored_at: string;
  /** Pre-computed by pipeline based on authored_at UTC offset */
  is_off_hours: boolean;
  author: string;
}

export interface PullRequest {
  id: number;
  number: number;
  author: string;
  avatar_url: string;
  title: string;
  /** ISO 8601 */
  created_at: string;
  /** ISO 8601 — null if not merged */
  merged_at: string | null;
  additions: number;
  deletions: number;
  /** Number of review rounds before approval */
  revision_cycles: number;
  /** true if PR title/body references a bug/issue fix */
  is_bug_fix: boolean;
  commits: Commit[];
  /** Files modified that were last touched > 6 months ago (pre-computed by pipeline) */
  legacy_files_modified: number;
}

export interface IssueEvent {
  id: number;
  pr_id: number;
  /** "fixed"  → author of the PR gets a positive score
   *  "introduced" → author gets a negative score */
  type: "fixed" | "introduced";
  author: string;
  /** ISO 8601 */
  timestamp: string;
}

export interface PipelineMeta {
  /** ISO 8601 — when the pipeline last ran */
  fetched_at: string;
  /** How far back the dataset covers, in days (typically 90) */
  window_days: number;
}

/** Top-level shape of github_data.json.gz */
export interface GithubData {
  meta: PipelineMeta;
  pull_requests: PullRequest[];
  issue_events: IssueEvent[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Scoring Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RawMetrics {
  pr_metrics: number;
  cycle_time: number;
  pr_impact: number;
  bugs_attribution: number;
  legacy_code: number;
  off_hours: number;
}

export interface NormalizedMetrics {
  pr_metrics: number;
  cycle_time: number;
  pr_impact: number;
  bugs_attribution: number;
  legacy_code: number;
  off_hours: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Schemas (§5A Leaderboard, §5B User Profile)
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  author: string;
  avatar_url: string;
  /** Final weighted score, 0–100 */
  total_score: number;
  metrics: NormalizedMetrics;
}

export interface LeaderboardResponse {
  /** ISO 8601 */
  last_updated: string;
  days_window: number;
  rankings: LeaderboardEntry[];
}

export interface DailyStats {
  issues_fixed: number;
  issues_introduced: number;
  features_introduced: number;
  pr_count: number;
  off_hours_commits: number;
  legacy_files_modified: number;
}

export interface TimeSeriesEntry {
  /** YYYY-MM-DD */
  date: string;
  pr_metrics_score: number;
  cycle_time_score: number;
  pr_impact_score: number;
  bugs_attribution_score: number;
  legacy_code_score: number;
  off_hours_score: number;
  raw_stats: DailyStats;
}

export interface UserStats {
  avg_pr_size: PRSize;
  avg_cycle_time_hours: number;
  review_pass_rate_pct: number;
}

export interface UserProfileResponse {
  author: string;
  avatar_url: string;
  total_score: number;
  metrics_radar: NormalizedMetrics;
  time_series: TimeSeriesEntry[];
  stats: UserStats;
}
