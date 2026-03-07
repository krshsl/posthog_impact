import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import type { UserProfileResponse } from '@/lib/types';

interface ProfileHeaderProps {
  profile: UserProfileResponse;
  rank: number;
}

export function ProfileHeader({ profile, rank }: ProfileHeaderProps) {
  return (
    <Card className="p-6 bg-zinc-950/50 border-zinc-800/60 backdrop-blur transform-gpu">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-zinc-800 shadow-xl shadow-cyan-500/10">
          <AvatarImage src={profile.avatar_url} alt={profile.author} />
          <AvatarFallback className="text-3xl bg-zinc-900 text-zinc-400">
            {profile.author.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100 flex flex-col sm:flex-row sm:items-center gap-3">
            {profile.author}
            {rank <= 10 && (
              <Badge variant="outline" className="w-fit mx-auto sm:mx-0 bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-mono text-sm gap-1 px-3 py-1">
                <Trophy className="w-4 h-4" /> Global Rank #{rank}
              </Badge>
            )}
            {rank > 10 && (
              <Badge variant="outline" className="w-fit mx-auto sm:mx-0 bg-zinc-800 text-zinc-300 border-zinc-700 font-mono text-sm px-3 py-1">
                Global Rank #{rank}
              </Badge>
            )}
          </h1>
          <p className="text-zinc-400">
            90-day impact summary based on PR activity, reviews, and bugs.
          </p>
        </div>

        <div className="text-center sm:text-right shrink-0 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 min-w-[160px]">
          <div className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">Total Score</div>
          <div className="text-4xl font-bold font-mono tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 to-blue-600">
            {profile.total_score.toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}
