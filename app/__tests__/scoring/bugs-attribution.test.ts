import { calcAllBugsAttribution } from "../../lib/scoring/bugs-attribution";
import type { PullRequest } from "../../lib/types";

function mockPR(
  author: string,
  fixedCount: number = 0,
  bugIntroducer: string | null = null
): PullRequest {
  return {
    number: Math.floor(Math.random() * 1000),
    title: "Test PR",
    author_login: author,
    created_at: "2026-02-01T00:00:00Z",
    merged_at: "2026-02-01T12:00:00Z",
    additions: 100,
    deletions: 50,
    changed_files: 3,
    is_draft: false,
    commits: [],
    reviews_first_at: null,
    issues_fixed: Array(fixedCount).fill({ number: 1, author_login: "x", created_at: "" }),
    bug_introduced_by: bugIntroducer,
    maintenance_score: 0,
  };
}

describe("calcAllBugsAttribution", () => {
  it("returns empty object for no PRs", () => {
    expect(calcAllBugsAttribution([])).toEqual({});
  });

  it("correctly rewards bug fixes", () => {
    const prs = [mockPR("alice", 2)];
    expect(calcAllBugsAttribution(prs)).toEqual({ alice: 20 }); // 2 * 10
  });

  it("correctly penalises bug introductions", () => {
    const prs = [mockPR("other", 0, "bob")];
    // -15 floored to 0
    expect(calcAllBugsAttribution(prs)).toEqual({ other: 0, bob: 0 });
  });

  it("floors negative net scores at 0", () => {
    // 1 fix (10) - 2 introduced (-30) = -20 → floored to 0
    const prs = [
      mockPR("carol", 1, "carol"),
      mockPR("other", 0, "carol"),
    ];
    expect(calcAllBugsAttribution(prs).carol).toBe(0);
  });

  it("handles multiple authors independently", () => {
    const prs = [
      mockPR("alice", 1),
      mockPR("other", 0, "bob"),
      mockPR("alice", 1),
    ];
    const result = calcAllBugsAttribution(prs);
    expect(result.alice).toBe(20); // 2 * 10
    expect(result.bob).toBe(0);    // -15 floored
  });
});
