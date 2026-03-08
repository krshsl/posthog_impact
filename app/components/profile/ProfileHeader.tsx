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
    <Card className="p-6 bg-zinc-900/40 border-zinc-800 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border border-zinc-800 grayscale">
          <AvatarImage src={profile.avatar_url} alt={profile.author} />
          <AvatarFallback className="text-3xl bg-zinc-900 text-zinc-600">
            {profile.author.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100 flex flex-col sm:flex-row sm:items-center gap-3">
            {profile.author}
            {rank <= 10 && (
              <Badge variant="outline" className="w-fit mx-auto sm:mx-0 bg-zinc-100 text-zinc-900 border-none font-bold text-xs px-2 py-0.5 rounded-none uppercase tracking-tighter">
                Rank #{rank}
              </Badge>
            )}
            {rank > 10 && (
              <Badge variant="outline" className="w-fit mx-auto sm:mx-0 bg-zinc-800 text-zinc-300 border-zinc-700 font-mono text-sm px-3 py-1">
                Rank #{rank}
              </Badge>
            )}
          </h1>
          <p className="text-zinc-500 text-sm">
            Impact summary calculated over the selected time window.
          </p>
        </div>

        <div className="flex flex-col items-center sm:items-end shrink-0 sm:pl-6 sm:border-l sm:border-zinc-800/50">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Impact Score</div>
          <div className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-zinc-100 tabular-nums">
            {profile.total_score.toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}
