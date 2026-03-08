"use client";

import { motion } from 'framer-motion';
import { LeaderboardRow } from './LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Medal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LeaderboardTableProps {
  users: LeaderboardEntry[];
}

export function LeaderboardTable({ users }: LeaderboardTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleCardClick = (author: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('user', author);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const top5 = users.slice(0, 5);
  // Reorder for Mountain layout: 4, 2, 1, 3, 5
  const mountainOrder = [3, 1, 0, 2, 4]; // indices for 4th, 2nd, 1st, 3rd, 5th
  const mountainTop5 = mountainOrder.map(index => top5[index]).filter(Boolean);

  const getRankScale = (rank: number) => {
    switch (rank) {
      case 1: return "lg:scale-115 lg:-translate-y-8 z-30 shadow-cyan-500/40";
      case 2: return "lg:scale-105 lg:-translate-y-4 lg:-translate-x-1 z-20 shadow-zinc-500/20";
      case 3: return "lg:scale-105 lg:-translate-y-4 lg:translate-x-1 z-20 shadow-zinc-500/20";
      default: return "lg:scale-95 z-10 opacity-90";
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "from-yellow-500/10 via-yellow-500/5 to-transparent border-yellow-500/40 text-yellow-500";
      case 2: return "from-zinc-300/10 via-zinc-300/5 to-transparent border-zinc-400/40 text-zinc-300";
      case 3: return "from-amber-700/10 via-amber-700/5 to-transparent border-amber-800/40 text-amber-600";
      case 4: return "from-blue-400/10 via-blue-400/5 to-transparent border-blue-500/40 text-blue-400";
      case 5: return "from-indigo-400/10 via-indigo-400/5 to-transparent border-indigo-500/40 text-indigo-400";
      default: return "border-zinc-800/60 text-zinc-500";
    }
  };

  return (
    <div className="space-y-12">
      {/* Top 5 Hero Strip - Mountain Layout */}
      <div className="flex flex-col lg:flex-row items-end justify-center gap-4 lg:gap-6 xl:gap-10 px-2 lg:px-4 py-8">
        {mountainTop5.map((user, i) => (
          <motion.div
            key={user.author}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            onClick={() => handleCardClick(user.author)}
            className={`w-full lg:w-1/5 max-w-[280px] lg:max-w-none cursor-pointer ${getRankScale(user.rank)} transition-all duration-500 hover:z-50`}
          >
            <Card className={`relative overflow-hidden bg-zinc-950/40 backdrop-blur-md border-2 ${getRankColor(user.rank).split(' ').find(s => s.startsWith('border-'))} hover:border-cyan-500/60 transition-all shadow-2xl group`}>
              <div className={`absolute inset-0 bg-gradient-to-b ${getRankColor(user.rank).split(' ').slice(0, 3).join(' ')} opacity-60`} />
              <div className="relative p-6 flex flex-col items-center text-center space-y-4">
                <div className="relative group-hover:scale-110 transition-transform duration-300">
                  <Avatar className="h-20 w-20 border-2 border-zinc-800 ring-4 ring-black/40 shadow-2xl">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{user.author.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 rounded-full p-2 border border-zinc-800 shadow-xl bg-zinc-950 ${getRankColor(user.rank).split(' ').pop()}`}>
                    <Medal className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-2 w-full">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Rank #{user.rank}</span>
                    <h3 className="font-bold text-zinc-100 line-clamp-1 text-base xl:text-lg tracking-tight" title={user.author}>{user.author}</h3>
                  </div>
                  <div className="py-2 px-3 bg-zinc-900/80 rounded-lg border border-zinc-800/50 shadow-inner group-hover:border-cyan-500/30 transition-colors">
                    <div className="text-2xl xl:text-3xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]">
                      {user.total_score.toLocaleString()}
                    </div>
                    <div className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest mt-0.5">Impact Points</div>
                  </div>
                </div>
              </div>
              {user.rank === 1 && (
                <div className="absolute top-0 right-0 p-2">
                  <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest shadow-lg animate-pulse">Leader</Badge>
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800/60">
              <tr>
                <th scope="col" className="px-4 py-4 text-center w-16">Rank</th>
                <th scope="col" className="px-4 py-4">Engineer</th>
                <th scope="col" className="px-4 py-4 text-right">Total Score</th>
                <th scope="col" className="px-4 py-4 text-center">PR Quality</th>
                <th scope="col" className="px-4 py-4 text-center">Cycle Time</th>
                <th scope="col" className="px-4 py-4 text-center">Impact</th>
                <th scope="col" className="px-4 py-4 text-center">Bugs</th>
                <th scope="col" className="px-4 py-4 text-center">Legacy Refactor</th>
                <th scope="col" className="px-4 py-4 text-center">Off-Hours</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <LeaderboardRow key={user.author} user={user} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
