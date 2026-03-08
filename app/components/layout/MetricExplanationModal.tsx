"use client";

import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function MetricExplanationModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-zinc-500 border-zinc-800 hover:text-zinc-100 transition-colors gap-2"
        >
          <Info className="h-4 w-4" />
          Understanding Metrics
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-100">
            Metric Explanations
          </DialogTitle>
          <DialogDescription className="text-zinc-500 mt-1">
            How Engineering Impact is calculated over a rolling window. All metrics are normalized (0-100) before weights are applied.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard title="PR Metrics" weight="15%">
            Based on PR count, size (XS to XL), and review pass rate. Prevents gaming via excessive small changes.
          </MetricCard>
          <MetricCard title="Cycle Time" weight="5%">
            Tracks time from creation to first review, and time in review. Scaled relative to PR size.
          </MetricCard>
          <MetricCard title="PR Impact" weight="20%">
            Measures tangible outcomes: quantity of resolved issues and new features.
          </MetricCard>
          <MetricCard title="Bugs Attr." weight="25%">
            Positive for fixes. Negative if recent code changes authored by the user directly caused the bug.
          </MetricCard>
          <MetricCard title="Maintenance" weight="20%">
            Rewards modifications to older dormant or rarely-touched code.
          </MetricCard>
          <MetricCard title="Off-Hours" weight="15%">
            Rewards "degen" hours: Commits pushed before 09:00, after 18:00 local time, or on weekends.
          </MetricCard>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ title, weight, children }: { title: string, weight: string, children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-zinc-100">{title}</span>
        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">{weight} Weight</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">
        {children}
      </p>
    </div>
  );
}
