import type { Commit } from "../types";

/**
 * Off-Hours Commits (15% weight)
 *
 * Rewards "above and beyond" effort outside standard working hours.
 * `is_off_hours` is pre-computed by the pipeline based on the UTC offset
 * embedded in each commit's authored_at timestamp.
 * Off-hours = before 09:00 or after 18:00 local time, OR any weekend day.
 *
 * raw = (off_hours_commits / total_commits) * 100
 *       capped at 100.
 * A contributor with 0 commits scores 0.
 */
export function calcOffHours(commits: Commit[]): number {
  if (commits.length === 0) return 0;

  const offHoursCount = commits.filter((c) => c.is_off_hours).length;
  return Math.min((offHoursCount / commits.length) * 100, 100);
}
