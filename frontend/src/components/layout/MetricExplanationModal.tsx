import { HelpCircle } from 'lucide-react';
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
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-cyan-400 hover:bg-zinc-900 ml-2 rounded-full h-9 w-9">
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Explain Metrics</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-200">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            Metric Explanations
          </DialogTitle>
          <DialogDescription className="text-zinc-400 mt-2">
            How PostHog Engineering Impact is calculated over a 90-day rolling window.
            All metrics are normalized to a 0-100 scale before weights are applied.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">

          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/60">
            <h4 className="font-semibold text-zinc-100 flex items-center justify-between">
              <span>PR Metrics</span>
              <span className="text-xs font-mono font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded">15% Weight</span>
            </h4>
            <p className="text-sm text-zinc-400 mt-2">
              Based on PR count, additions/deletions, size (XS to XL), and review pass rate.
              Normalized to prevent gaming the system via excessive small changes.
            </p>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/60">
            <h4 className="font-semibold text-zinc-100 flex items-center justify-between">
              <span>Cycle Time Breakdown</span>
              <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">5% Weight</span>
            </h4>
            <p className="text-sm text-zinc-400 mt-2">
              Tracks time from creation to first review, and time in review.
              Scaled relative to PR size (fast large PRs = high positive signal).
            </p>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/60">
            <h4 className="font-semibold text-zinc-100 flex items-center justify-between">
              <span>PR Impact</span>
              <span className="text-xs font-mono font-medium text-purple-400 bg-purple-400/10 px-2 py-1 rounded">20% Weight</span>
            </h4>
            <p className="text-sm text-zinc-400 mt-2">
              Measures tangible outcomes: quantity of resolved issues and newly introduced features within a PR.
            </p>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/60">
            <h4 className="font-semibold text-zinc-100 flex items-center justify-between">
              <span>Bugs Attribution</span>
              <span className="text-xs font-mono font-medium text-rose-400 bg-rose-400/10 px-2 py-1 rounded">25% Weight</span>
            </h4>
            <p className="text-sm text-zinc-400 mt-2">
              Positive signals for fixing issues. Negative signals applied if recent code changes authored by the user directly caused the bug (via blame).
            </p>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/60">
            <h4 className="font-semibold text-zinc-100 flex items-center justify-between">
              <span>Legacy Code Refactoring</span>
              <span className="text-xs font-mono font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded">20% Weight</span>
            </h4>
            <p className="text-sm text-zinc-400 mt-2">
              Rewards modifications to code last touched &gt; 6 months ago, acknowledging the higher cognitive load required to context-switch into old abstractions.
            </p>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/60">
            <h4 className="font-semibold text-zinc-100 flex items-center justify-between">
              <span>Off-Hours Commits</span>
              <span className="text-xs font-mono font-medium text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded">15% Weight</span>
            </h4>
            <p className="text-sm text-zinc-400 mt-2">
              Rewards "degen" hours: Commits pushed before 09:00, after 18:00 local time, or on weekends.
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
