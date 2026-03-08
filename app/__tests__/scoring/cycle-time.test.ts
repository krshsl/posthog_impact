import { calcCycleTime, getPRSize } from "../../lib/scoring/cycle-time";
import type { PullRequest } from "../../lib/types";

function mockPR(
  additions: number,
  deletions: number,
  createdAt: string,
  mergedAt: string | null
): PullRequest {
  return {
    id: 1,
    number: 1001,
    author: "alice",
    avatar_url: "",
    title: "feat",
    created_at: createdAt,
    merged_at: mergedAt,
    additions,
    deletions,
    revision_cycles: 0,
    is_bug_fix: false,
    legacy_files_modified: 0,
    commits: [],
  };
}

describe("getPRSize", () => {
  it("classifies XS correctly", () => expect(getPRSize(20, 10)).toBe("XS"));
  it("classifies S correctly",  () => expect(getPRSize(100, 50)).toBe("S"));
  it("classifies M correctly",  () => expect(getPRSize(300, 100)).toBe("M"));
  it("classifies L correctly",  () => expect(getPRSize(600, 200)).toBe("L"));
  it("classifies XL correctly", () => expect(getPRSize(800, 300)).toBe("XL"));
});

describe("calcCycleTime", () => {
  it("returns 0 for empty PRs", () => {
    expect(calcCycleTime([])).toBe(0);
  });

  it("returns 0 when no PRs are merged", () => {
    const pr = mockPR(200, 100, "2026-02-01T00:00:00Z", null);
    expect(calcCycleTime([pr])).toBe(0);
  });

  it("scores super-fast XS PR near 100", () => {
    // XS expected = 4h, actual = 1h → (4/1)*100 = 400, capped at 100
    const pr = mockPR(20, 10,
      "2026-02-01T00:00:00Z",
      "2026-02-01T01:00:00Z"   // 1 hour later
    );
    expect(calcCycleTime([pr])).toBe(100);
  });

  it("scores slow XS PR low (small PR taking 72h is penalized)", () => {
    // XS expected = 4h, actual = 72h → (4/72)*100 ≈ 5.55
    const pr = mockPR(20, 10,
      "2026-02-01T00:00:00Z",
      "2026-02-04T00:00:00Z"   // 72 hours later
    );
    expect(calcCycleTime([pr])).toBeCloseTo(5.55, 0);
  });

  it("rewards XL PRs that merge faster than expected", () => {
    // XL expected = 96h, actual = 36h → (96/36)*100 ≈ 266 → capped at 100
    const pr = mockPR(800, 400,
      "2026-02-01T00:00:00Z",
      "2026-02-02T12:00:00Z"   // 36 hours later
    );
    expect(calcCycleTime([pr])).toBe(100);
  });
});
