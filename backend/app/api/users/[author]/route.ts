import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadGithubData } from "../../../../lib/data-loader";
import { getLeaderboardCache, setLeaderboardCache } from "../../../../lib/cache";
import { buildLeaderboard, buildUserProfile } from "../../../../lib/scoring/engine";

// ISR: cache per-user profiles for 24 hours
export const revalidate = 86400;

const QuerySchema = z.object({
  days: z
    .string()
    .default("90")
    .transform(Number)
    .pipe(z.union([z.literal(7), z.literal(15), z.literal(30), z.literal(60), z.literal(90)])),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ author: string }> }
) {
  const { author } = await params;
  const { searchParams } = new URL(request.url);

  const parsed = QuerySchema.safeParse({ days: searchParams.get("days") ?? "90" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid 'days' parameter. Must be one of: 7, 15, 30, 60, 90" },
      { status: 400 }
    );
  }

  const { days } = parsed.data;

  const githubData = await loadGithubData();

  // Build or reuse leaderboard (needed for normalised scores)
  let leaderboard = getLeaderboardCache(days);
  if (!leaderboard) {
    leaderboard = buildLeaderboard(githubData, days);
    setLeaderboardCache(days, leaderboard);
  }

  const profile = buildUserProfile(githubData, author, days, leaderboard);

  if (!profile) {
    return NextResponse.json(
      { error: `Author '${author}' not found in the ${days}-day window.` },
      { status: 404 }
    );
  }

  return NextResponse.json(profile);
}
