import {
  GithubData,
  PullRequest,
  RawMetrics,
  LeaderboardEntry,
  LeaderboardResponse,
  UserProfileResponse,
  TimeSeriesEntry,
  UserStats,
  PRSize,
} from "../types";

import { calcPRMetrics } from "./pr-metrics";
import { calcCycleTime, getPRSize } from "./cycle-time";
import { calcPRImpact } from "./pr-impact";
import { calcAllBugsAttribution } from "./bugs-attribution";
import { calcMaintenance } from "./maintenance";
import { calcOffHours } from "./off-hours";
import { normalizeMetrics, applyWeights } from "./normalizer";

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function toDateStr(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function windowStart(days: number): Date {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

// ─── Data Slicing ─────────────────────────────────────────────────────────────

function filterPRs(prs: PullRequest[], since: Date): PullRequest[] {
  return prs.filter((pr) => {
    return new Date(pr.created_at) >= since && pr.merged_at !== null;
  });
}

// ─── Per-Author Grouping ──────────────────────────────────────────────────────

interface AuthorInfo {
  author_login: string;
  avatar_url: string;
  prs: PullRequest[];
}

function groupByAuthor(prs: PullRequest[]): Record<string, AuthorInfo> {
  const map: Record<string, AuthorInfo> = {};
  for (const pr of prs) {
    const login = pr.author_login;
    if (!map[login]) {
      map[login] = {
        author_login: login,
        avatar_url: `https://github.com/${login}.png`,
        prs: [],
      };
    }
    map[login].prs.push(pr);
  }
  return map;
}

// ─── Raw Score Computation ────────────────────────────────────────────────────

function computeRawMetrics(
  authorMap: Record<string, AuthorInfo>,
  allBugScores: Record<string, number>
): Record<string, RawMetrics> {
  const result: Record<string, RawMetrics> = {};

  for (const [author, { prs }] of Object.entries(authorMap)) {
    const allCommits = prs.flatMap((pr) => pr.commits);

    result[author] = {
      pr_metrics: calcPRMetrics(prs),
      cycle_time: calcCycleTime(prs),
      pr_impact: calcPRImpact(prs),
      bugs_attribution: allBugScores[author] ?? 0,
      maintenance: calcMaintenance(prs),
      off_hours: calcOffHours(allCommits.map(c => ({ ...c, is_off_hours: c.is_off_hours || false, author: c.author_login, authored_at: c.date, sha: c.oid }))),
    };
  }

  return result;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export function buildLeaderboard(
  data: GithubData,
  days: number
): LeaderboardResponse {
  const since = windowStart(days);

  const filteredPRs = filterPRs(data.pull_requests || [], since);

  const authorMap = groupByAuthor(filteredPRs);
  const bugScores = calcAllBugsAttribution(filteredPRs);
  const rawMetrics = computeRawMetrics(authorMap, bugScores);
  const normalizedMap = normalizeMetrics(rawMetrics);

  const entries: LeaderboardEntry[] = Object.entries(normalizedMap)
    .map(([author, metrics]) => {
      // Round individual normalized metrics
      const roundedMetrics = {
        pr_metrics: Math.round(metrics.pr_metrics),
        cycle_time: Math.round(metrics.cycle_time),
        pr_impact: Math.round(metrics.pr_impact),
        bugs_attribution: Math.round(metrics.bugs_attribution),
        maintenance: Math.round(metrics.maintenance),
        off_hours: Math.round(metrics.off_hours),
      };

      return {
        rank: 0,
        author,
        avatar_url: authorMap[author].avatar_url,
        total_score: Math.round(applyWeights(roundedMetrics)),
        metrics: roundedMetrics,
      };
    })
    .sort((a, b) => b.total_score - a.total_score)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return {
    last_updated: data.meta.last_fetched_at,
    days_window: days,
    rankings: entries,
  };
}

// ─── User Profile ─────────────────────────────────────────────────────────────

function avgPRSize(prs: PullRequest[]): PRSize {
  if (prs.length === 0) return "XS";
  const avgLines = prs.reduce((s, p) => s + p.additions + p.deletions, 0) / prs.length;
  // Approximation for size calculation
  const total = avgLines;
  if (total < 50) return "XS";
  if (total < 200) return "S";
  if (total < 500) return "M";
  if (total < 1000) return "L";
  return "XL";
}

function buildTimeSeries(
  prs: PullRequest[]
): TimeSeriesEntry[] {
  type DayBucket = {
    prs: PullRequest[];
    issues_fixed: number;
    issues_introduced: number;
  };

  const dayMap: Record<string, DayBucket> = {};

  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const d = toDateStr(pr.merged_at);
    if (!dayMap[d]) dayMap[d] = { prs: [], issues_fixed: 0, issues_introduced: 0 };
    dayMap[d].prs.push(pr);
    dayMap[d].issues_fixed += pr.issues_fixed.length;
    // We don't have a clean way to attribute bug introduction to a specific DATE here
    // unless we look at where this author was mentioned in bug_introduced_by on other PRs.
    // Simplifying: we'll only track fixes for the time series for now, or assume 0 for introduced.
  }

  const dates = Object.keys(dayMap).sort();

  return dates.map((date) => {
    const { prs: dayPRs, issues_fixed, issues_introduced } = dayMap[date];
    const allCommits = dayPRs.flatMap((p) => p.commits);

    const rawDay: RawMetrics = {
      pr_metrics: calcPRMetrics(dayPRs),
      cycle_time: calcCycleTime(dayPRs),
      pr_impact: calcPRImpact(dayPRs),
      bugs_attribution: issues_fixed * 10 - issues_introduced * 15,
      maintenance: calcMaintenance(dayPRs),
      off_hours: calcOffHours(allCommits.map(c => ({ ...c, is_off_hours: c.is_off_hours || false, author: c.author_login, authored_at: c.date, sha: c.oid }))),
    };

    return {
      date,
      pr_metrics_score: parseFloat(Math.max(rawDay.pr_metrics, 0).toFixed(2)),
      cycle_time_score: parseFloat(Math.min(rawDay.cycle_time, 100).toFixed(2)),
      pr_impact_score: parseFloat(Math.max(rawDay.pr_impact, 0).toFixed(2)),
      bugs_attribution_score: parseFloat(Math.max(rawDay.bugs_attribution, 0).toFixed(2)),
      maintenance_score: parseFloat(Math.max(rawDay.maintenance, 0).toFixed(2)),
      off_hours_score: parseFloat(Math.min(rawDay.off_hours, 100).toFixed(2)),
      raw_stats: {
        issues_fixed,
        issues_introduced,
        features_introduced: dayPRs.filter((p) => p.issues_fixed.length === 0).length,
        pr_count: dayPRs.length,
        off_hours_commits: allCommits.filter((c) => c.is_off_hours).length,
        maintenance_score_sum: dayPRs.reduce((s, p) => s + (p.maintenance_score || 0), 0),
      },
    };
  });
}

export function buildUserProfile(
  data: GithubData,
  author: string,
  days: number,
  leaderboard: LeaderboardResponse
): UserProfileResponse | null {
  const entry = leaderboard.rankings.find((r) => r.author === author);
  if (!entry) return null;

  const since = windowStart(days);

  const authorPRs = filterPRs(data.pull_requests || [], since).filter(
    (pr) => pr.author_login === author
  );

  const allMergedPRs = authorPRs.filter((p) => p.merged_at !== null);

  const avgCycleMs =
    allMergedPRs.length === 0
      ? 0
      : allMergedPRs.reduce((sum, p) => {
          return (
            sum +
            (new Date(p.merged_at!).getTime() - new Date(p.created_at).getTime())
          );
        }, 0) / allMergedPRs.length;

  const stats: UserStats = {
    avg_pr_size: avgPRSize(allMergedPRs),
    avg_cycle_time_hours: parseFloat((avgCycleMs / (1000 * 3600)).toFixed(1)),
    review_pass_rate_pct: 0, // Not available in current pipeline
  };

  return {
    author,
    avatar_url: entry.avatar_url,
    total_score: entry.total_score,
    metrics_radar: entry.metrics,
    time_series: buildTimeSeries(authorPRs),
    stats,
  };
}
