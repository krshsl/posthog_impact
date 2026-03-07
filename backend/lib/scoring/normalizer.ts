import type { RawMetrics, NormalizedMetrics } from "../types";

const WEIGHTS: Record<keyof RawMetrics, number> = {
  pr_metrics:       0.15,
  cycle_time:       0.05,
  pr_impact:        0.20,
  bugs_attribution: 0.25,
  legacy_code:      0.20,
  off_hours:        0.15,
};

/**
 * Min-max normalises each metric dimension independently across all authors.
 * Score = (raw - min) / (max - min) * 100, capped in [0,100].
 * If all authors have the same raw score on a dimension, everyone gets 0
 * (rather than NaN) since there's no differentiation.
 */
export function normalizeMetrics(
  authorRaws: Record<string, RawMetrics>
): Record<string, NormalizedMetrics> {
  const metrics = Object.keys(WEIGHTS) as (keyof RawMetrics)[];
  const authors = Object.keys(authorRaws);

  if (authors.length === 0) return {};

  // Find min/max for each metric across all authors
  const mins: Record<string, number> = {};
  const maxs: Record<string, number> = {};
  for (const m of metrics) {
    const values = authors.map((a) => authorRaws[a][m]);
    mins[m] = Math.min(...values);
    maxs[m] = Math.max(...values);
  }

  const result: Record<string, NormalizedMetrics> = {};

  for (const author of authors) {
    const raw = authorRaws[author];
    const normalized = {} as NormalizedMetrics;

    for (const m of metrics) {
      const range = maxs[m] - mins[m];
      normalized[m] =
        range === 0
          ? 0
          : Math.min(((raw[m] - mins[m]) / range) * 100, 100);
    }

    result[author] = normalized;
  }

  return result;
}

/**
 * Applies the spec-defined weights to a set of already-normalized metrics
 * and produces a final `total_score` in [0, 100].
 */
export function applyWeights(normalized: NormalizedMetrics): number {
  return (
    normalized.pr_metrics       * WEIGHTS.pr_metrics       +
    normalized.cycle_time       * WEIGHTS.cycle_time       +
    normalized.pr_impact        * WEIGHTS.pr_impact        +
    normalized.bugs_attribution * WEIGHTS.bugs_attribution +
    normalized.legacy_code      * WEIGHTS.legacy_code      +
    normalized.off_hours        * WEIGHTS.off_hours
  );
}
