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
  const mountainOrder = [3, 1, 0, 2, 4]; // indices for 4th, 2nd, 1st, 3rd, 5th
  const mountainTop5 = mountainOrder.map(index => top5[index]).filter(Boolean);

  const getRankScale = (rank: number) => {
    switch (rank) {
      case 1: return "lg:scale-105 lg:-translate-y-4 z-30";
      case 2: return "lg:scale-100 lg:-translate-y-2 z-20";
      case 3: return "lg:scale-100 lg:-translate-y-2 z-20";
      default: return "lg:scale-95 z-10 opacity-90";
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "border-yellow-500/50 text-yellow-500";
      case 2: return "border-zinc-400/50 text-zinc-300";
      case 3: return "border-amber-800/50 text-amber-600";
      default: return "border-zinc-800 text-zinc-500";
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
            className={`w-full lg:w-1/5 max-w-[280px] lg:max-w-none ${getRankScale(user.rank)} transition-all duration-500 hover:z-50`}
          >
            <Link
              href={`/?user=${user.author}&days=${days}`}
              scroll={false}
              prefetch={true}
            >
              <Card className={`relative overflow-hidden bg-zinc-900/50 border ${getRankColor(user.rank).split(' ').find(s => s.startsWith('border-'))} transition-all group hover:bg-zinc-900/80`}>
                <div className="relative p-6 flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20 border border-zinc-800 transition-all duration-300">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>{user.author.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 rounded-full p-1.5 border border-zinc-800 bg-zinc-950 ${getRankColor(user.rank).split(' ').pop()}`}>
                      <Medal className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-2 w-full">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Rank #{user.rank}</span>
                      <h3 className="font-bold text-zinc-100 line-clamp-1 text-base xl:text-lg tracking-tight" title={user.author}>{user.author}</h3>
                    </div>
                    <div className="py-2 px-3 bg-zinc-950 rounded-lg border border-zinc-800">
                      <div className="text-2xl xl:text-3xl font-bold font-mono tracking-tighter text-zinc-100">
                        {user.total_score.toLocaleString()}
                      </div>
                      <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest mt-0.5">Impact Points</div>
                    </div>
                  </div>
                </div>
                {user.rank === 1 && (
                  <div className="absolute top-0 right-0 p-2">
                    <Badge className="bg-zinc-100 hover:bg-zinc-100 text-zinc-900 text-[8px] font-bold px-1.5 py-0 rounded-none uppercase tracking-tighter">Leader</Badge>
                  </div>
                )}
              </Card>
            </Link>
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
                <th scope="col" className="px-4 py-4 text-center">Maintenance</th>
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
