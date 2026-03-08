import { calcPRMetrics } from "../../lib/scoring/pr-metrics";
import type { PullRequest } from "../../lib/types";

function mockPR(
  additions: number,
  deletions: number,
  merged = true
): PullRequest {
  return {
    number: 1001,
    author_login: "alice",
    title: "feat: test PR",
    created_at: "2026-02-01T10:00:00Z",
    merged_at: merged ? "2026-02-02T10:00:00Z" : null,
    additions,
    deletions,
    changed_files: 1,
    is_draft: false,
    commits: [],
    reviews_first_at: null,
    issues_fixed: [],
    bug_introduced_by: null,
    maintenance_score: 0,
  };
}

describe("calcPRMetrics", () => {
  it("returns 0 for empty PRs", () => {
    expect(calcPRMetrics([])).toBe(0);
  });

  it("applies heavy churn penalty for micro PRs (avg < 50 lines)", () => {
    // Large PRs: avg size 300
    const largePRs = [mockPR(300, 100), mockPR(400, 150), mockPR(200, 80)];
    // Micro PRs: avg size ~25
    const microPRs = [mockPR(10, 5), mockPR(15, 8), mockPR(12, 6)];
    
    expect(calcPRMetrics(microPRs)).toBeLessThan(calcPRMetrics(largePRs));
  });

  it("gives a positive score for standard-sized PRs", () => {
    expect(calcPRMetrics([mockPR(400, 150)])).toBeGreaterThan(0);
  });

  it("micro churn (avg < 50) multiplier is 0.2", () => {
    // Large PR (400+150=550) -> base=1, size_bonus=550/2000=0.275 -> score = (1 + 0.275*5) * 1 = 2.375
    // Micro PR (10+5=15) -> base=1, size_bonus=15/2000=0.0075 -> score = (1 + 0.0075*5) * 0.2 = 0.2075
    const largeScore = calcPRMetrics([mockPR(400, 150)]);
    const microScore = calcPRMetrics([mockPR(10, 5)]);
    
    expect(microScore).toBeLessThan(largeScore * 0.2); 
  });
});
