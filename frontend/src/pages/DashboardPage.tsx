import { useEffect } from 'react';
import useSWR from 'swr';
import { fetchLeaderboard, fetchUserProfile } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Loader2 } from 'lucide-react';

export function DashboardPage() {
  const { daysWindow } = useAppStore();

  const { data, error, isLoading } = useSWR(
    ['/api/leaderboard', daysWindow],
    ([, days]) => fetchLeaderboard(days)
  );

  // Prefetch top 5 users on mount/load
  useEffect(() => {
    if (data?.rankings) {
      const top5 = data.rankings.slice(0, 5);
      Promise.allSettled(
        top5.map((user) => fetchUserProfile(user.author, daysWindow))
      );
    }
  }, [data, daysWindow]);

  if (error) {
    return (
      <div className="pt-24 flex justify-center text-rose-400">
        Failed to load leaderboard data. Mocks might be missing.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="pt-32 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pt-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Engineering Impact Leaderboard</h1>
        <p className="text-zinc-400 mt-2">
          Rankings are calculated dynamically based on PR output, cycle time, feature impact, bug attribution, and legacy code refactoring over the last {daysWindow} days.
        </p>
      </div>

      <LeaderboardTable users={data.rankings} />
    </div>
  );
}
