import Link from 'next/link';
import { Activity } from 'lucide-react';
import { DaySelector } from '@/components/leaderboard/DaySelector';
import { MetricExplanationModal } from './MetricExplanationModal';

export function Topbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2 transition-opacity hover:opacity-80">
            <div className="bg-cyan-500/20 p-2 rounded-lg">
              <Activity className="h-6 w-6 text-cyan-400" />
            </div>
            <span className="inline-block font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400 hidden sm:inline-block">
              PostHog Impact
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <DaySelector />
          <MetricExplanationModal />
        </div>
      </div>
    </header>
  );
}
