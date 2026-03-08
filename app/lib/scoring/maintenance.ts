import type { PullRequest } from "../types";

const MAINTENANCE_REWARD_PER_FILE = 5;

/**
 * Maintenance (20% weight)
 *
 * Rewards developers who modify older dormant files (Dormancy) 
 * or rarely-touched files (Rareness).
 */
export function calcMaintenance(prs: PullRequest[]): number {
  const totalMaintenanceScore = prs.reduce(
    (sum, pr) => sum + (pr.maintenance_score || 0),
    0
  );
  return totalMaintenanceScore * MAINTENANCE_REWARD_PER_FILE;
}
