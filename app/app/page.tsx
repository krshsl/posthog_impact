import { buildLeaderboard, buildUserProfile } from '@/lib/scoring/engine';
import { loadGithubData } from '@/lib/data-loader';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Topbar } from '@/components/layout/Topbar';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ProfileView } from '@/components/ProfileView';
import { MetricExplanationSection } from '@/components/layout/MetricExplanationModal';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const days = params.days ? parseInt(params.days as string, 10) : 90;
  const user = params.user as string | undefined;

  const data = await loadGithubData();
  const leaderboard = buildLeaderboard(data, days);

  let userProfile = null;
  if (user) {
    userProfile = buildUserProfile(data, user, days, leaderboard);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30">
      <Topbar />
      <PageWrapper>
        {userProfile ? (
          <ProfileView
            profile={userProfile}
            rank={leaderboard.rankings.find((r: any) => r.author === user)?.rank ?? 0}
          />
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500 pt-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Engineering Impact Leaderboard</h1>
                <p className="text-zinc-500 mt-1 text-sm">
                  Rankings are calculated dynamically based on PR output, cycle time, feature impact, bug attribution, and legacy code refactoring over the last {days} days.
                </p>
              </div>
              <MetricExplanationSection />
            </div>
            <LeaderboardTable users={leaderboard.rankings} />
          </div>
        )}
      </PageWrapper>
    </div>
  );
}
