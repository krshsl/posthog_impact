"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LeaderboardRow } from './LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Medal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LeaderboardTableProps {
  users: LeaderboardEntry[];
}

export function LeaderboardTable({ users }: LeaderboardTableProps) {
  const searchParams = useSearchParams();
  const days = searchParams.get('days') || '90';

  const top5 = users.slice(0, 5);
  // Reorder for Mountain layout: 4, 2, 1, 3, 5
  const mountainOrder = [3, 1, 0, 2, 4];
  const mountainTop5 = mountainOrder.map(index => top5[index]).filter(Boolean);

  // Responsive mountain shape: only use Y-translation on mobile to prevent overlapping, 
  // add scale back in on larger screens.
  const getRankScale = (rank: number) => {
    switch (rank) {
      case 1: return "z-30 -translate-y-4 md:-translate-y-8 md:scale-110";
      case 2:
      case 3: return "z-20 -translate-y-2 md:-translate-y-4 md:scale-105";
      default: return "z-10 scale-100 opacity-90 hover:opacity-100";
    }
  };

  const getCardStyles = (rank: number) => {
    switch (rank) {
      case 1: return "border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]";
      case 2: return "border-zinc-400/50";
      case 3: return "border-amber-700/50";
      default: return "border-zinc-800";
    }
  };

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-yellow-500";
      case 2: return "text-zinc-300";
      case 3: return "text-amber-600";
      default: return "text-zinc-500";
    }
  };

  return (
    <div className="space-y-12">
      {/* Top 5 Hero Strip - Mountain Layout */}
      {/* Container: pt-8 ensures the #1 card doesn't get cut off at the top when translated up */}
      <div className="flex flex-row items-end justify-center gap-1.5 sm:gap-3 md:gap-4 lg:gap-6 pt-12 pb-4 px-1 sm:px-4">
        {mountainTop5.map((user, i) => (
          <motion.div
            key={user.author}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            // flex-1 min-w-0 ensures they share row space evenly and trigger text truncation properly
            className={`flex-1 min-w-0 max-w-[180px] ${getRankScale(user.rank)} transition-all duration-300 group`}
          >
            <Link
              href={`/?user=${user.author}&days=${days}`}
              scroll={false}
              prefetch={true}
              className="block outline-none"
            >
              <Card className={`relative overflow-hidden bg-zinc-900/60 border ${getCardStyles(user.rank)} hover:bg-zinc-900 transition-colors p-2 sm:p-3 md:p-5 flex flex-col items-center text-center h-full`}>

                {/* 1st Place Badge */}
                {user.rank === 1 && (
                  <div className="absolute top-0 right-0">
                    <Badge className="bg-zinc-100 text-zinc-900 text-[8px] md:text-[10px] font-bold px-1.5 py-0 md:px-2 md:py-0.5 rounded-none rounded-bl-lg uppercase tracking-tighter hover:bg-zinc-200 border-none">
                      1st
                    </Badge>
                  </div>
                )}

                {/* Avatar */}
                <div className="relative mb-2 md:mb-4">
                  <Avatar className="h-8 w-8 sm:h-12 sm:w-12 md:h-16 md:w-16 border border-zinc-800 transition-all duration-300 group-hover:border-zinc-600">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-[10px] md:text-sm">{user.author.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 md:-bottom-1.5 md:-right-1.5 rounded-full p-0.5 md:p-1 border border-zinc-800 bg-zinc-950">
                    <Medal className={`w-3 h-3 md:w-4 md:h-4 ${getMedalColor(user.rank)}`} />
                  </div>
                </div>

                {/* User Info */}
                <div className="w-full flex flex-col items-center space-y-1 md:space-y-2">
                  <span className="hidden lg:block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Rank #{user.rank}</span>

                  {/* Truncate ensures long names get "..." instead of wrapping and breaking layout */}
                  <h3 className="font-bold text-zinc-100 truncate w-full px-1 text-[10px] sm:text-xs md:text-sm lg:text-base tracking-tight" title={user.author}>
                    {user.author}
                  </h3>

                  {/* Score */}
                  <div className="w-full py-1 md:py-2 px-1 bg-zinc-950/80 rounded border border-zinc-800/50 group-hover:border-zinc-700/50 transition-colors">
                    <div className="text-xs sm:text-sm md:text-xl lg:text-2xl font-bold font-mono tracking-tighter text-zinc-100">
                      {user.total_score.toLocaleString()}
                    </div>
                    <div className="hidden lg:block sm:block sm:text-[7px] lg:text-[9px] font-medium text-zinc-500 uppercase tracking-widest mt-0.5">Impact Points</div>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left block md:table min-w-[800px]">
            <thead className="hidden md:table-header-group text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800/60">
              <tr>
                <th scope="col" className="px-4 py-4 text-center w-16">Rank</th>
                <th scope="col" className="px-4 py-4">Engineer</th>
                <th scope="col" className="px-4 py-4 text-right">Total Score</th>
                <th scope="col" className="px-4 py-4 text-center">PR Quality</th>
                <th scope="col" className="px-4 py-4 text-center">Cycle Time</th>
                <th scope="col" className="px-4 py-4 text-center">Impact</th>
                <th scope="col" className="px-4 py-4 text-center">Bugs</th>
                <th scope="col" className="px-4 py-4 text-center">Maintenance</th>
                <th scope="col" className="px-4 py-4 text-center">Off-Hours</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group w-full">
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
