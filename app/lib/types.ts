// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Output Schema (github_data.json.gz)
// ─────────────────────────────────────────────────────────────────────────────

export type PRSize = "XS" | "S" | "M" | "L" | "XL";

export interface Commit {
  oid: string;
  author_login: string;
  /** ISO 8601 with UTC offset */
  date: string;
  /** Pre-computed by pipeline */
  is_off_hours: boolean;
}

export interface IssueRef {
  number: number;
  author_login: string;
  created_at: string;
}

export interface PullRequest {
  number: number;
  title: string;
  author_login: string;
  /** ISO 8601 */
  created_at: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  is_draft: boolean;
  commits: Commit[];
  /** Earliest review timestamp */
  reviews_first_at: string | null;
  /** Issues that were resolved by this PR */
  issues_fixed: IssueRef[];
  /** Who introduced the bug that this PR fixes */
  bug_introduced_by: string | null;
  /** Weighted score based on age of dormant files and rareness touched */
  maintenance_score: number;
}

export interface PipelineMeta {
  last_fetched_at: string;
  earliest_fetched_at: string;
  window_days: number;
}

/** Top-level shape of github_data.json.gz */
export interface GithubData {
  meta: PipelineMeta;
  pull_requests: PullRequest[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Scoring Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RawMetrics {
  pr_metrics: number;
  cycle_time: number;
  pr_impact: number;
  bugs_attribution: number;
  maintenance: number;
  off_hours: number;
}

export interface NormalizedMetrics {
  pr_metrics: number;
  cycle_time: number;
  pr_impact: number;
  bugs_attribution: number;
  maintenance: number;
  off_hours: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Schemas
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  author: string;
  avatar_url: string;
  total_score: number;
  metrics: NormalizedMetrics;
}

export interface LeaderboardResponse {
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
  maintenance_score_sum: number;
}

export interface TimeSeriesEntry {
  date: string;
  pr_metrics_score: number;
  cycle_time_score: number;
  pr_impact_score: number;
  bugs_attribution_score: number;
  maintenance_score: number;
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
