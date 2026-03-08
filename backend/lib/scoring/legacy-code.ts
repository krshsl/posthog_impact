import type { PullRequest } from "../types";

const LEGACY_REWARD_PER_FILE = 5;

/**
 * Legacy Code (20% weight)
 *
 * Rewards developers who modify files that haven't been touched in >6 months.
 */
export function calcLegacyCode(prs: PullRequest[]): number {
  const totalLegacyFiles = prs.reduce(
    (sum, pr) => sum + (pr.legacy_file_count || 0),
    0
  );
  return totalLegacyFiles * LEGACY_REWARD_PER_FILE;
}
