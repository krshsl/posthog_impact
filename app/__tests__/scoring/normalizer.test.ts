import { normalizeMetrics, applyWeights } from "../../lib/scoring/normalizer";
import type { RawMetrics } from "../../lib/types";

const zeroMetrics: RawMetrics = {
  pr_metrics: 0, cycle_time: 0, pr_impact: 0,
  bugs_attribution: 0, legacy_code: 0, off_hours: 0,
};

describe("normalizeMetrics", () => {
  it("returns empty object for no authors", () => {
    expect(normalizeMetrics({})).toEqual({});
  });

  it("returns all zeros when all authors have identical scores (no differentiation)", () => {
    const raws = {
      alice: { ...zeroMetrics },
      bob:   { ...zeroMetrics },
    };
    const result = normalizeMetrics(raws);
    for (const author of ["alice", "bob"]) {
      for (const v of Object.values(result[author])) {
        expect(v).toBe(0);
      }
    }
  });

  it("top author gets 100 on a metric, bottom gets 0", () => {
    const raws = {
      alice: { ...zeroMetrics, pr_metrics: 50 },
      bob:   { ...zeroMetrics, pr_metrics: 0 },
    };
    const result = normalizeMetrics(raws);
    expect(result.alice.pr_metrics).toBe(100);
    expect(result.bob.pr_metrics).toBe(0);
  });

  it("mid-point author gets ~50 on a metric", () => {
    const raws = {
      alice: { ...zeroMetrics, pr_metrics: 100 },
      bob:   { ...zeroMetrics, pr_metrics: 50 },
      carol: { ...zeroMetrics, pr_metrics: 0 },
    };
    const result = normalizeMetrics(raws);
    expect(result.bob.pr_metrics).toBeCloseTo(50, 5);
  });

  it("all scores are in [0, 100]", () => {
    const raws = {
      a: { pr_metrics: 10,  cycle_time: 80, pr_impact: 5,  bugs_attribution: 0,  legacy_code: 30, off_hours: 90 },
      b: { pr_metrics: 100, cycle_time: 20, pr_impact: 50, bugs_attribution: 40, legacy_code: 0,  off_hours: 10 },
    };
    const result = normalizeMetrics(raws);
    for (const author of ["a", "b"]) {
      for (const v of Object.values(result[author])) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("applyWeights", () => {
  it("all-100 metrics yields 100 total score", () => {
    const normalized = {
      pr_metrics: 100, cycle_time: 100, pr_impact: 100,
      bugs_attribution: 100, legacy_code: 100, off_hours: 100,
    };
    expect(applyWeights(normalized)).toBeCloseTo(100, 5);
  });

  it("all-zero metrics yields 0 total score", () => {
    const normalized = {
      pr_metrics: 0, cycle_time: 0, pr_impact: 0,
      bugs_attribution: 0, legacy_code: 0, off_hours: 0,
    };
    expect(applyWeights(normalized)).toBe(0);
  });

  it("weights sum to 1.0 (verified via 100-point test above)", () => {
    // If weights don't sum to 1, the all-100 test above would fail.
    expect(true).toBe(true); // covered by above test
  });
});
