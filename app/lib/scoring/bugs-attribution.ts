import type { PullRequest } from "../types";

const FIXED_REWARD   = 10;
const INTRODUCED_PEN = 15;

/**
 * Bug Attribution (25% weight)
 * 
 * Works purely with PR data now.
 * - Positive: author of a PR that has issues in `issues_fixed`.
 * - Negative: user in `bug_introduced_by` field of any PR in the window.
 */
export function calcBugsAttribution(
  prs: PullRequest[],
  author: string
): number {
  const fixedCount = prs
    .filter((p) => p.author_login === author)
    .reduce((sum, p) => sum + p.issues_fixed.length, 0);

  const introducedCount = prs.filter(
    (p) => p.bug_introduced_by === author
  ).length;

  const raw = fixedCount * FIXED_REWARD - introducedCount * INTRODUCED_PEN;
  return Math.max(raw, 0);
}

export function calcAllBugsAttribution(
  prs: PullRequest[]
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const pr of prs) {
    const solver = pr.author_login;
    const introducer = pr.bug_introduced_by;

    if (!(solver in scores)) scores[solver] = 0;
    scores[solver] += pr.issues_fixed.length * FIXED_REWARD;

    if (introducer) {
      if (!(introducer in scores)) scores[introducer] = 0;
      scores[introducer] -= INTRODUCED_PEN;
    }
  }

  for (const author in scores) {
    scores[author] = Math.max(scores[author], 0);
  }

  return scores;
}
