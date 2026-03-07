import type { PullRequest } from "../types";

/**
 * PR Metrics (15% weight)
 *
 * Rewards PRs that are appropriately-sized and pass review on the first try.
 * Penalises micro-PR churn (many tiny PRs that individually add little).
 *
 * Raw score formula:
 *   base       = pr_count
 *   size_bonus = avg(min(additions+deletions, 2000)) / 2000   ← caps XL PRs to avoid gaming
 *   churn_pen  = if avg_size < 50 lines, multiply by 0.2 (heavy churn penalty)
 *   pass_bonus = review_pass_rate (0–1)
 *   raw = (base + size_bonus * 5 + pass_bonus * 5) * churn_pen
 */
export function calcPRMetrics(prs: PullRequest[]): number {
  if (prs.length === 0) return 0;

  const prCount = prs.length;

  const avgSize =
    prs.reduce((sum, p) => sum + p.additions + p.deletions, 0) / prCount;

  const sizeBonus =
    prs.reduce((sum, p) => sum + Math.min(p.additions + p.deletions, 2000), 0) /
    prCount /
    2000;

  const passCount = prs.filter((p) => p.revision_cycles === 0).length;
  const reviewPassRate = passCount / prCount;

  // Churn penalty: if avg PR is XS (<50 lines), suppress the entire score
  const churnMultiplier = avgSize < 50 ? 0.2 : 1.0;

  const raw =
    (prCount + sizeBonus * 5 + reviewPassRate * 5) * churnMultiplier;

  return raw;
}
