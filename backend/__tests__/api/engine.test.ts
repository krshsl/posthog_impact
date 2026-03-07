import { buildLeaderboard, buildUserProfile } from "../../lib/scoring/engine";
import { getMockData } from "../../lib/mock-data";

const VALID_DAYS = [7, 15, 30, 60, 90] as const;

describe("buildLeaderboard", () => {
  const data = getMockData();

  it("returns correct shape for all valid day windows", () => {
    for (const days of VALID_DAYS) {
      const result = buildLeaderboard(data, days);
      expect(result).toHaveProperty("last_updated");
      expect(result).toHaveProperty("days_window", days);
      expect(Array.isArray(result.rankings)).toBe(true);
    }
  });

  it("rankings are sorted by total_score descending", () => {
    const result = buildLeaderboard(data, 90);
    for (let i = 1; i < result.rankings.length; i++) {
      expect(result.rankings[i - 1].total_score).toBeGreaterThanOrEqual(
        result.rankings[i].total_score
      );
    }
  });

  it("rank field is sequential starting from 1", () => {
    const result = buildLeaderboard(data, 90);
    result.rankings.forEach((entry, i) => {
      expect(entry.rank).toBe(i + 1);
    });
  });

  it("all total_scores are in [0, 100]", () => {
    const result = buildLeaderboard(data, 90);
    for (const entry of result.rankings) {
      expect(entry.total_score).toBeGreaterThanOrEqual(0);
      expect(entry.total_score).toBeLessThanOrEqual(100);
    }
  });

  it("each metrics object has all 6 metric keys", () => {
    const result = buildLeaderboard(data, 90);
    const requiredKeys = [
      "pr_metrics", "cycle_time", "pr_impact",
      "bugs_attribution", "legacy_code", "off_hours",
    ];
    for (const entry of result.rankings) {
      for (const key of requiredKeys) {
        expect(entry.metrics).toHaveProperty(key);
      }
    }
  });

  it("all metric values are in [0, 100]", () => {
    const result = buildLeaderboard(data, 90);
    for (const entry of result.rankings) {
      for (const v of Object.values(entry.metrics)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("smaller windows have fewer or equal rankings than larger windows", () => {
    const r7  = buildLeaderboard(data, 7);
    const r90 = buildLeaderboard(data, 90);
    expect(r7.rankings.length).toBeLessThanOrEqual(r90.rankings.length);
  });

  it("known contributor mariusandra appears in 90-day window", () => {
    const result = buildLeaderboard(data, 90);
    const found = result.rankings.find((r) => r.author === "mariusandra");
    expect(found).toBeDefined();
  });
});

describe("buildUserProfile", () => {
  const data = getMockData();
  const leaderboard = buildLeaderboard(data, 90);

  it("returns null for unknown author", () => {
    const profile = buildUserProfile(data, "ghost-author", 90, leaderboard);
    expect(profile).toBeNull();
  });

  it("returns a valid profile for a known author", () => {
    const profile = buildUserProfile(data, "mariusandra", 90, leaderboard);
    expect(profile).not.toBeNull();
    expect(profile!.author).toBe("mariusandra");
    expect(profile!.total_score).toBeGreaterThanOrEqual(0);
    expect(profile!.total_score).toBeLessThanOrEqual(100);
  });

  it("profile has all required fields", () => {
    const profile = buildUserProfile(data, "mariusandra", 90, leaderboard);
    expect(profile).toHaveProperty("author");
    expect(profile).toHaveProperty("avatar_url");
    expect(profile).toHaveProperty("total_score");
    expect(profile).toHaveProperty("metrics_radar");
    expect(profile).toHaveProperty("time_series");
    expect(profile).toHaveProperty("stats");
  });

  it("metrics_radar has all 6 keys in [0, 100]", () => {
    const profile = buildUserProfile(data, "mariusandra", 90, leaderboard);
    const keys = [
      "pr_metrics", "cycle_time", "pr_impact",
      "bugs_attribution", "legacy_code", "off_hours",
    ];
    for (const key of keys) {
      const val = (profile!.metrics_radar as Record<string, number>)[key];
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("time_series entries have correct shape", () => {
    const profile = buildUserProfile(data, "mariusandra", 90, leaderboard);
    expect(Array.isArray(profile!.time_series)).toBe(true);
    if (profile!.time_series.length > 0) {
      const entry = profile!.time_series[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("raw_stats");
      expect(entry.raw_stats).toHaveProperty("pr_count");
      expect(entry.raw_stats).toHaveProperty("issues_fixed");
    }
  });

  it("stats.avg_pr_size is a valid PRSize string", () => {
    const profile = buildUserProfile(data, "mariusandra", 90, leaderboard);
    expect(["XS", "S", "M", "L", "XL"]).toContain(profile!.stats.avg_pr_size);
  });

  it("stats.review_pass_rate_pct is in [0, 100]", () => {
    const profile = buildUserProfile(data, "mariusandra", 90, leaderboard);
    expect(profile!.stats.review_pass_rate_pct).toBeGreaterThanOrEqual(0);
    expect(profile!.stats.review_pass_rate_pct).toBeLessThanOrEqual(100);
  });
});
