"use client";

import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { MetricsRadarChart } from "@/components/profile/MetricsRadarChart";
import { StatsSummaryCards } from "@/components/profile/StatsSummaryCards";
import { TimeSeriesAreaChart } from "@/components/profile/TimeSeriesAreaChart";
import type { UserProfileResponse } from "@/lib/types";

interface ProfileModalProps {
  profile: UserProfileResponse;
  rank: number;
}

export function ProfileModal({ profile, rank }: ProfileModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const params = new URLSearchParams(searchParams);
      params.delete("user");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader className="sr-only">
          <DialogTitle>{profile.author}'s Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <ProfileHeader profile={profile} rank={rank} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <MetricsRadarChart metrics={profile.metrics_radar} />
            </div>
            <div className="lg:col-span-2">
              <StatsSummaryCards stats={profile.stats} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
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
      </DialogContent>
    </Dialog>
  );
}
