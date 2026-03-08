import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitPullRequest, Clock, CheckCircle } from "lucide-react";

interface StatsSummaryCardsProps {
  stats: {
    avg_pr_size: 'XS' | 'S' | 'M' | 'L' | 'XL';
    avg_cycle_time_hours: number;
    review_pass_rate_pct: number;
  }
}

export function StatsSummaryCards({ stats }: StatsSummaryCardsProps) {
  const getPrSizeColor = (size: string) => {
    switch (size) {
      case 'XS': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'S': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'M': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'L': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'XL': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
      <Card className="bg-zinc-950/50 border-zinc-800/60 shadow-md">
        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full space-y-4">
          <div className="bg-purple-500/10 p-3 rounded-full">
            <GitPullRequest className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-400 mb-2">Avg PR Size</p>
            <Badge variant="outline" className={`text-lg px-4 py-1 font-mono ${getPrSizeColor(stats.avg_pr_size)}`}>
              {stats.avg_pr_size}
            </Badge>
            <p className="text-[10px] text-zinc-500 mt-2 leading-tight">Median lines of code per pull request</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-950/50 border-zinc-800/60 shadow-md">
        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full space-y-4">
          <div className="bg-emerald-500/10 p-3 rounded-full">
            <Clock className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-400 mb-1">Avg Cycle Time</p>
            <p className="text-3xl font-bold font-mono text-zinc-100">
              {stats.avg_cycle_time_hours}<span className="text-xl text-zinc-500 ml-1">hrs</span>
            </p>
            <p className="text-[10px] text-zinc-500 mt-2 leading-tight">Time from first commit to merge</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-950/50 border-zinc-800/60 shadow-md">
        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full space-y-4">
          <div className="bg-cyan-500/10 p-3 rounded-full">
            <CheckCircle className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-400 mb-1">Review Pass Rate</p>
            <p className="text-3xl font-bold font-mono text-zinc-100">
              {stats.review_pass_rate_pct}%
            </p>
            <p className="text-[10px] text-zinc-500 mt-2 leading-tight">% of PRs merged without requested changes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
