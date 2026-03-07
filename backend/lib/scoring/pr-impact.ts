import type { PullRequest } from "../types";

/**
 * PR Impact (20% weight)
 *
 * Rewards shipping meaningful, non-bug *feature* PRs.
 * Bug-fix PRs are tracked separately under Bug Attribution.
 * Formula:
 *   For each non-bug PR: score = size_multiplier (based on lines changed)
 *   raw = sum of feature PR size multipliers
 */
export function calcPRImpact(prs: PullRequest[]): number {
  const featurePRs = prs.filter((p) => !p.is_bug_fix && p.merged_at !== null);
  if (featurePRs.length === 0) return 0;

  return featurePRs.reduce((sum, pr) => {
    const total = pr.additions + pr.deletions;
    // Multiplier: larger PRs get bigger rewards, but logarithmically capped
    const multiplier = Math.min(Math.log2(total + 1), 12); // log2(4097) ≈ 12
    return sum + multiplier;
  }, 0);
}
