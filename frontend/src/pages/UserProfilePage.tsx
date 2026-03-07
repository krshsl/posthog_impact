import useSWR from 'swr';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchLeaderboard, fetchUserProfile } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';

import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { MetricsRadarChart } from '@/components/profile/MetricsRadarChart';
import { TimeSeriesAreaChart } from '@/components/profile/TimeSeriesAreaChart';
import { StatsSummaryCards } from '@/components/profile/StatsSummaryCards';

export function UserProfilePage() {
  const { author } = useParams<{ author: string }>();
  const { daysWindow } = useAppStore();

  // Concurrently fetch profile + leaderboard (to get rank)
  const { data: profile, isLoading: isLoadingProfile } = useSWR(
    author ? ['/api/users', author, daysWindow] : null,
    ([, a, days]) => fetchUserProfile(a as string, days)
  );

  const { data: leaderboard } = useSWR(
    ['/api/leaderboard', daysWindow],
    ([, days]) => fetchLeaderboard(days)
  );

  if (isLoadingProfile || !profile) {
    return (
      <div className="pt-32 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const rank = leaderboard?.rankings.find((u) => u.author === profile.author)?.rank ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pt-6">
      <Link to="/">
        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 -ml-4">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Leaderboard
        </Button>
      </Link>

      <ProfileHeader profile={profile} rank={rank} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <MetricsRadarChart metrics={profile.metrics_radar} />
        </div>
        <div className="lg:col-span-2">
          <StatsSummaryCards stats={profile.stats} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
        <TimeSeriesAreaChart
          data={profile.time_series}
          title="Issues & Features Impact"
          description="Track bugs fixed, created, and new features introduced."
          dataKeys={[
            { key: 'issues_fixed', label: 'Issues Fixed', color: '#10b981' }, // emerald-500
            { key: 'issues_introduced', label: 'Issues Introduced', color: '#f43f5e' }, // rose-500
            { key: 'features_introduced', label: 'Features Introduced', color: '#3b82f6' }, // blue-500
          ]}
        />
        <TimeSeriesAreaChart
          data={profile.time_series}
          title="PR & Commit Activity"
          description="Total PRs and off-hours commit volume over time."
          dataKeys={[
            { key: 'pr_count', label: 'PRs Merged', color: '#8b5cf6' }, // violet-500
            { key: 'off_hours_commits', label: 'Off-Hours Commits', color: '#f59e0b' }, // amber-500
            { key: 'legacy_files_modified', label: 'Legacy Files Mod.', color: '#06b6d4' }, // cyan-500
          ]}
        />
      </div>
    </div>
  );
}
