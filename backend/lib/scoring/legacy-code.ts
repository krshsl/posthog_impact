import type { PullRequest } from "../types";

const LEGACY_REWARD_PER_FILE = 5;

/**
 * Legacy Code (20% weight)
 *
 * Rewards developers who modify files that haven't been touched in >6 months.
 * The cognitive load of understanding old code is considered valuable signal.
 *
 * raw = sum of legacy_files_modified across all PRs in the window
 *       * LEGACY_REWARD_PER_FILE
 */
export function calcLegacyCode(prs: PullRequest[]): number {
  const totalLegacyFiles = prs.reduce(
    (sum, pr) => sum + pr.legacy_files_modified,
    0
  );
  return totalLegacyFiles * LEGACY_REWARD_PER_FILE;
}
