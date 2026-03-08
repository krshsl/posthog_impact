import { calcPRMetrics } from "../../lib/scoring/pr-metrics";
import type { PullRequest } from "../../lib/types";

function mockPR(
  additions: number,
  deletions: number,
  revisionCycles = 0,
  merged = true
): PullRequest {
  return {
    id: 1,
    number: 1001,
    author: "alice",
    avatar_url: "https://example.com/avatar.png",
    title: "feat: test PR",
    created_at: "2026-02-01T10:00:00Z",
    merged_at: merged ? "2026-02-02T10:00:00Z" : null,
    additions,
    deletions,
    revision_cycles: revisionCycles,
    is_bug_fix: false,
    legacy_files_modified: 0,
    commits: [],
  };
}

describe("calcPRMetrics", () => {
  it("returns 0 for empty PRs", () => {
    expect(calcPRMetrics([])).toBe(0);
  });

  it("applies heavy churn penalty for micro PRs (avg < 50 lines)", () => {
    const microPRs = [mockPR(10, 5), mockPR(15, 8), mockPR(12, 6)];
    const largePRs = [mockPR(300, 100), mockPR(400, 150), mockPR(200, 80)];
    expect(calcPRMetrics(microPRs)).toBeLessThan(calcPRMetrics(largePRs));
  });

  it("rewards 100% review pass rate", () => {
    const allPass   = [mockPR(200, 80, 0), mockPR(300, 100, 0)];
    const revisions = [mockPR(200, 80, 3), mockPR(300, 100, 2)];
    expect(calcPRMetrics(allPass)).toBeGreaterThan(calcPRMetrics(revisions));
  });

  it("gives a positive score for standard-sized PRs", () => {
    expect(calcPRMetrics([mockPR(400, 150, 0)])).toBeGreaterThan(0);
  });

  it("micro churn (avg < 50) multiplier is 0.2", () => {
    // Micro PRs: avg total = (15 + 15) = 30 < 50 → multiplier 0.2
    const raw = calcPRMetrics([mockPR(10, 5), mockPR(10, 5)]);
    expect(raw).toBeGreaterThan(0);
    expect(raw).toBeLessThan(5); // enforces dampening
  });
});
