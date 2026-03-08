import { cache } from 'react';
import { buildLeaderboard, buildUserProfile } from '@/lib/scoring/engine';
import { loadGithubData } from '@/lib/data-loader';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Topbar } from '@/components/layout/Topbar';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ProfileView } from '@/components/ProfileView';
import { MetricExplanationModal } from '@/components/layout/MetricExplanationModal';

// Per-request memoization for scoring logic
const getCachedLeaderboard = cache(async (days: number) => {
  const data = await loadGithubData();
  return buildLeaderboard(data, days);
});

const getCachedUserProfile = cache(async (user: string, days: number) => {
  const data = await loadGithubData();
  const leaderboard = await getCachedLeaderboard(days);
  return buildUserProfile(data, user, days, leaderboard);
});

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const days = params.days ? parseInt(params.days as string, 10) : 90;
  const user = params.user as string | undefined;

  const leaderboard = await getCachedLeaderboard(days);
  const userProfile = user ? await getCachedUserProfile(user, days) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30">
      <Topbar />
      <PageWrapper>
        {/* Profile View (Overlay/Replacement) */}
        {userProfile && (
          <div className="animate-in fade-in duration-300">
            <ProfileView
              profile={userProfile}
              rank={leaderboard.rankings.find((r: any) => r.author === user)?.rank ?? 0}
            />
          </div>
        )}

        {/* Leaderboard View (Stay mounted but hidden when profile is active) */}
        <div className={`space-y-8 pt-8 ${userProfile ? 'hidden' : 'animate-in fade-in duration-500'}`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Engineering Impact Leaderboard</h1>
              <p className="text-zinc-500 text-sm max-w-2xl">
                Rankings are calculated dynamically based on PR output, cycle time, feature impact, bug attribution, and legacy code refactoring over the last {days} days.
              </p>
            </div>
            <MetricExplanationModal />
          </div>
          <LeaderboardTable users={leaderboard.rankings} />
        </div>
      </PageWrapper>
    </div>
  );
}
