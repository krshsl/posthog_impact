import type {
  GithubData,
  PullRequest,
  IssueEvent,
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
import { calcLegacyCode } from "./legacy-code";
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
    // Include PRs created within the window that were subsequently merged
    return new Date(pr.created_at) >= since && pr.merged_at !== null;
  });
}

function filterIssueEvents(events: IssueEvent[], since: Date): IssueEvent[] {
  return events.filter((e) => new Date(e.timestamp) >= since);
}

// ─── Per-Author Grouping ──────────────────────────────────────────────────────

interface AuthorInfo {
  avatar_url: string;
  prs: PullRequest[];
}

function groupByAuthor(prs: PullRequest[]): Record<string, AuthorInfo> {
  const map: Record<string, AuthorInfo> = {};
  for (const pr of prs) {
    if (!map[pr.author]) {
      map[pr.author] = { avatar_url: pr.avatar_url, prs: [] };
    }
    map[pr.author].prs.push(pr);
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
      pr_metrics:       calcPRMetrics(prs),
      cycle_time:       calcCycleTime(prs),
      pr_impact:        calcPRImpact(prs),
      bugs_attribution: allBugScores[author] ?? 0,
      legacy_code:      calcLegacyCode(prs),
      off_hours:        calcOffHours(allCommits),
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

  const filteredPRs    = filterPRs(data.pull_requests, since);
  const filteredEvents = filterIssueEvents(data.issue_events, since);

  const authorMap    = groupByAuthor(filteredPRs);
  const bugScores    = calcAllBugsAttribution(filteredEvents);
  const rawMetrics   = computeRawMetrics(authorMap, bugScores);
  const normalizedMap = normalizeMetrics(rawMetrics);

  const entries: LeaderboardEntry[] = Object.entries(normalizedMap)
    .map(([author, metrics]) => ({
      rank:        0, // assigned after sort
      author,
      avatar_url:  authorMap[author].avatar_url,
      total_score: parseFloat(applyWeights(metrics).toFixed(2)),
      metrics,
    }))
    .sort((a, b) => b.total_score - a.total_score)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return {
    last_updated: data.meta.fetched_at,
    days_window:  days,
    rankings:     entries,
  };
}

// ─── User Profile ─────────────────────────────────────────────────────────────

function avgPRSize(prs: PullRequest[]): PRSize {
  if (prs.length === 0) return "XS";
  const avgLines = prs.reduce((s, p) => s + p.additions + p.deletions, 0) / prs.length;
  return getPRSize(avgLines / 2, avgLines / 2);
}

function buildTimeSeries(
  prs: PullRequest[],
  events: IssueEvent[]
): TimeSeriesEntry[] {
  // Group PRs by merged date
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
  }

  for (const ev of events) {
    const d = toDateStr(ev.timestamp);
    if (!dayMap[d]) dayMap[d] = { prs: [], issues_fixed: 0, issues_introduced: 0 };
    if (ev.type === "fixed")       dayMap[d].issues_fixed++;
    if (ev.type === "introduced")  dayMap[d].issues_introduced++;
  }

  const dates = Object.keys(dayMap).sort();

  return dates.map((date) => {
    const { prs: dayPRs, issues_fixed, issues_introduced } = dayMap[date];
    const allCommits = dayPRs.flatMap((p) => p.commits);

    // Use single-day raw scores (no cross-author comparison needed for timeseries)
    const rawDay: RawMetrics = {
      pr_metrics:       calcPRMetrics(dayPRs),
      cycle_time:       calcCycleTime(dayPRs),
      pr_impact:        calcPRImpact(dayPRs),
      bugs_attribution: issues_fixed * 10 - issues_introduced * 15,
      legacy_code:      calcLegacyCode(dayPRs),
      off_hours:        calcOffHours(allCommits),
    };

    const featuresIntroduced = dayPRs.filter((p) => !p.is_bug_fix).length;
    const offHoursCommits    = allCommits.filter((c) => c.is_off_hours).length;
    const legacyFiles        = dayPRs.reduce((s, p) => s + p.legacy_files_modified, 0);

    return {
      date,
      pr_metrics_score:       parseFloat(Math.max(rawDay.pr_metrics, 0).toFixed(2)),
      cycle_time_score:       parseFloat(Math.min(rawDay.cycle_time, 100).toFixed(2)),
      pr_impact_score:        parseFloat(Math.max(rawDay.pr_impact, 0).toFixed(2)),
      bugs_attribution_score: parseFloat(Math.max(rawDay.bugs_attribution, 0).toFixed(2)),
      legacy_code_score:      parseFloat(Math.max(rawDay.legacy_code, 0).toFixed(2)),
      off_hours_score:        parseFloat(Math.min(rawDay.off_hours, 100).toFixed(2)),
      raw_stats: {
        issues_fixed,
        issues_introduced,
        features_introduced: featuresIntroduced,
        pr_count:            dayPRs.length,
        off_hours_commits:   offHoursCommits,
        legacy_files_modified: legacyFiles,
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

  const authorPRs    = filterPRs(data.pull_requests, since).filter(
    (pr) => pr.author === author
  );
  const authorEvents = filterIssueEvents(data.issue_events, since).filter(
    (e) => e.author === author
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

  const passCount = allMergedPRs.filter((p) => p.revision_cycles === 0).length;

  const stats: UserStats = {
    avg_pr_size:          avgPRSize(allMergedPRs),
    avg_cycle_time_hours: parseFloat((avgCycleMs / (1000 * 3600)).toFixed(1)),
    review_pass_rate_pct: allMergedPRs.length === 0
      ? 0
      : parseFloat(((passCount / allMergedPRs.length) * 100).toFixed(1)),
  };

  return {
    author,
    avatar_url:    entry.avatar_url,
    total_score:   entry.total_score,
    metrics_radar: entry.metrics,
    time_series:   buildTimeSeries(authorPRs, authorEvents),
    stats,
  };
}
