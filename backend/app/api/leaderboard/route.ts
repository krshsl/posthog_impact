import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadGithubData } from "../../../lib/data-loader";
import { getLeaderboardCache, setLeaderboardCache } from "../../../lib/cache";
import { buildLeaderboard } from "../../../lib/scoring/engine";

// ISR: Vercel caches this route's response for 24 hours
export const revalidate = 86400;

const VALID_DAYS = [7, 15, 30, 60, 90] as const;
const QuerySchema = z.object({
  days: z
    .string()
    .default("90")
    .transform(Number)
    .pipe(z.union([z.literal(7), z.literal(15), z.literal(30), z.literal(60), z.literal(90)])),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const parsed = QuerySchema.safeParse({ days: searchParams.get("days") ?? "90" });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid 'days' parameter. Must be one of: " + VALID_DAYS.join(", "),
      },
      { status: 400 }
    );
  }

  const { days } = parsed.data;

  // Cache hit → return immediately
  const cached = getLeaderboardCache(days);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // Cache miss → compute and store
  const githubData = await loadGithubData();
  const leaderboard = buildLeaderboard(githubData, days);

  setLeaderboardCache(days, leaderboard);

  return NextResponse.json(leaderboard, {
    headers: { "X-Cache": "MISS" },
  });
}
