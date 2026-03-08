import type { PullRequest, PRSize } from "../types";

// Expected hours per PR size category
const EXPECTED_HOURS: Record<PRSize, number> = {
  XS: 4,
  S:  12,
  M:  24,
  L:  48,
  XL: 96,
};

export function getPRSize(additions: number, deletions: number): PRSize {
  const total = additions + deletions;
  if (total < 50)   return "XS";
  if (total < 200)  return "S";
  if (total < 500)  return "M";
  if (total < 1000) return "L";
  return "XL";
}

function cycleHours(pr: PullRequest): number | null {
  if (!pr.merged_at) return null;
  const ms = new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime();
  return ms / (1000 * 3600);
}

/**
 * Cycle Time (5% weight)
 *
 * Scores fast delivery relative to the PR size category.
 * Formula per PR: (expected_hours / actual_hours) * 100, capped at 100.
 * Author's final raw score = average across all merged PRs.
 */
export function calcCycleTime(prs: PullRequest[]): number {
  const mergedPRs = prs.filter((p) => p.merged_at !== null);
  if (mergedPRs.length === 0) return 0;

  const scores = mergedPRs.map((pr) => {
    const actual = cycleHours(pr)!;
    const size = getPRSize(pr.additions, pr.deletions);
    const expected = EXPECTED_HOURS[size];
    // Clamp: super-fast PRs cap at 100, super-slow PRs approach 0
    return Math.min((expected / Math.max(actual, 0.5)) * 100, 100);
  });

  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
