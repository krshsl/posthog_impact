import type { LeaderboardResponse } from "./types";

/**
 * Module-level singleton — survives across requests in the same server instance.
 * Keyed by `days` window value (e.g. 7, 15, 30, 60, 90).
 */
const leaderboardCache = new Map<number, LeaderboardResponse>();

export function getLeaderboardCache(days: number): LeaderboardResponse | undefined {
  return leaderboardCache.get(days);
}

export function setLeaderboardCache(days: number, data: LeaderboardResponse): void {
  leaderboardCache.set(days, data);
}

/** Used in tests to reset state between test cases. */
export function clearCache(): void {
  leaderboardCache.clear();
}
