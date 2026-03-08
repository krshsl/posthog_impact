"use client";

import { Info, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function MetricExplanationSection() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-zinc-500 border-zinc-800 hover:text-zinc-100 transition-colors gap-2"
      >
        <Info className="h-4 w-4" />
        Understanding Metrics
      </Button>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative animate-in fade-in slide-in-from-top-4 duration-500">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(false)}
        className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-100"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-100">Metric Explanations</h3>
          <p className="text-sm text-zinc-500 mt-1">
            How Engineering Impact is calculated over a 90-day rolling window. All metrics are normalized (0-100) before weights are applied.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard title="PR Metrics" weight="15%" color="border-zinc-800">
            Based on PR count, size (XS to XL), and review pass rate. Prevents gaming via excessive small changes.
          </MetricCard>
          <MetricCard title="Cycle Time" weight="5%" color="border-zinc-800">
            Tracks time from creation to first review, and time in review. Scaled relative to PR size.
          </MetricCard>
          <MetricCard title="PR Impact" weight="20%" color="border-zinc-800">
            Measures tangible outcomes: quantity of resolved issues and new features.
          </MetricCard>
          <MetricCard title="Bugs Attr." weight="25%" color="border-zinc-800">
            Positive for fixes. Negative if recent code changes authored by the user directly caused the bug.
          </MetricCard>
          <MetricCard title="Legacy Refactor" weight="20%" color="border-zinc-800">
            Rewards modifications to code last touched {">"} 6 months ago.
          </MetricCard>
          <MetricCard title="Off-Hours" weight="15%" color="border-zinc-800">
            Rewards "degen" hours: Commits pushed before 09:00, after 18:00 local time, or on weekends.
          </MetricCard>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, weight, color, children }: { title: string, weight: string, color: string, children: React.ReactNode }) {
  return (
    <div className={`p-4 rounded-lg border bg-zinc-950/50 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-zinc-100">{title}</span>
        <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">{weight} Weight</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed font-sans">
        {children}
      </p>
    </div>
  );
}
