import Link from 'next/link';
import { Activity } from 'lucide-react';
import { DaySelector } from '@/components/leaderboard/DaySelector';

export function Topbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2 transition-opacity hover:opacity-80">
            <Activity className="h-6 w-6 text-zinc-400" />
            <span className="inline-block font-bold text-lg text-zinc-100 hidden sm:inline-block">
              PostHog Impact
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <DaySelector />
        </div>
      </div>
    </header>
  );
}
