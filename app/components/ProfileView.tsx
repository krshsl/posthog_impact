"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { MetricsRadarChart } from "@/components/profile/MetricsRadarChart";
import { StatsSummaryCards } from "@/components/profile/StatsSummaryCards";
import { TimeSeriesAreaChart } from "@/components/profile/TimeSeriesAreaChart";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import type { UserProfileResponse } from "@/lib/types";

interface ProfileViewProps {
  profile: UserProfileResponse;
  rank: number;
}

export function ProfileView({ profile, rank }: ProfileViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleBack = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("user");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pt-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="text-zinc-400 hover:text-zinc-100 -ml-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Leaderboard
        </Button>
      </div>

      <div className="space-y-8 pb-12">
        <ProfileHeader profile={profile} rank={rank} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <MetricsRadarChart metrics={profile.metrics_radar} />
          </div>
          <div className="lg:col-span-2">
            <StatsSummaryCards stats={profile.stats} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TimeSeriesAreaChart
            data={profile.time_series}
            title="Issues & Features Impact"
            description="Track bugs fixed, created, and new features introduced."
            dataKeys={[
              { key: 'issues_fixed', label: 'Issues Fixed', color: '#10b981' },
              { key: 'issues_introduced', label: 'Issues Introduced', color: '#f43f5e' },
              { key: 'features_introduced', label: 'Features Introduced', color: '#3b82f6' },
            ]}
          />
          <TimeSeriesAreaChart
            data={profile.time_series}
            title="PR & Commit Activity"
            description="Total PRs and off-hours commit volume over time."
            dataKeys={[
              { key: 'pr_count', label: 'PRs Merged', color: '#8b5cf6' },
              { key: 'off_hours_commits', label: 'Off-Hours Commits', color: '#f59e0b' },
              { key: 'legacy_files_modified', label: 'Legacy Files Mod.', color: '#06b6d4' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
