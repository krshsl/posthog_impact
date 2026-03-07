export interface MetricScores {
  pr_metrics: number;
  cycle_time: number;
  pr_impact: number;
  bugs_attribution: number;
  legacy_code: number;
  off_hours: number;
}

export interface LeaderboardUser {
  rank: number;
  author: string;
  avatar_url: string;
  total_score: number;
  metrics: MetricScores;
}

export interface LeaderboardResponse {
  last_updated: string;
  days_window: number;
  rankings: LeaderboardUser[];
}

export interface RawDailyStats {
  issues_fixed: number;
  issues_introduced: number;
  features_introduced: number;
  pr_count: number;
  off_hours_commits: number;
  legacy_files_modified: number;
}

export interface TimeSeriesPoint extends MetricScores {
  date: string;
  raw_stats: RawDailyStats;
}

export interface UserProfileResponse {
  author: string;
  avatar_url: string;
  total_score: number;
  metrics_radar: MetricScores;
  time_series: TimeSeriesPoint[];
  stats: {
    avg_pr_size: 'XS' | 'S' | 'M' | 'L' | 'XL';
    avg_cycle_time_hours: number;
    review_pass_rate_pct: number;
  };
}
