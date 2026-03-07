import type { IssueEvent } from "../types";

const FIXED_REWARD   = 10;
const INTRODUCED_PEN = 15; // Introducing bugs penalises more than fixing rewards

/**
 * Bug Attribution (25% weight — highest)
 *
 * Positive: author fixed an issue (identified by PR closing an issue)
 * Negative: author introduced a bug (identified by pipeline git-blame attribution)
 *
 * raw = (fixed_count * FIXED_REWARD) - (introduced_count * INTRODUCED_PEN)
 * Floored at 0 — a net-negative author still gets 0 raw (not a negative score
 * that would distort normalisation).
 */
export function calcBugsAttribution(events: IssueEvent[], author: string): number {
  const fixedCount      = events.filter((e) => e.type === "fixed"      && e.author === author).length;
  const introducedCount = events.filter((e) => e.type === "introduced" && e.author === author).length;

  const raw = fixedCount * FIXED_REWARD - introducedCount * INTRODUCED_PEN;
  return Math.max(raw, 0);
}

/**
 * Run bug attribution for every unique author at once
 * (avoids iterating the events array once per author).
 */
export function calcAllBugsAttribution(
  events: IssueEvent[]
): Record<string, number> {
  const scores: Record<string, number> = {};

  // Initialise to 0 for any author appearing in any event
  for (const e of events) {
    if (!(e.author in scores)) scores[e.author] = 0;
    if (e.type === "fixed")       scores[e.author] += FIXED_REWARD;
    if (e.type === "introduced")  scores[e.author] -= INTRODUCED_PEN;
  }

  // Floor each score at 0
  for (const author in scores) {
    scores[author] = Math.max(scores[author], 0);
  }

  return scores;
}
