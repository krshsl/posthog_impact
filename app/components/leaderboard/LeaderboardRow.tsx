"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Medal } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { LeaderboardEntry } from '@/lib/types';

interface LeaderboardRowProps {
  user: LeaderboardEntry;
  index: number;
}

export function LeaderboardRow({ user, index }: LeaderboardRowProps) {
  const searchParams = useSearchParams();
  const days = searchParams.get('days') || '90';

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return <Medal className="w-6 h-6 text-yellow-500 fill-yellow-500/20" />;
      case 2: return <Medal className="w-6 h-6 text-zinc-300 fill-zinc-300/20" />;
      case 3: return <Medal className="w-6 h-6 text-amber-700 fill-amber-700/20" />;
      case 4: return <Medal className="w-5 h-5 text-blue-400" />;
      case 5: return <Medal className="w-5 h-5 text-indigo-400" />;
      default: return <span className="text-zinc-500 font-mono w-6 text-center">{rank}</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (score >= 70) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors relative"
    >
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center w-8">
          {getRankBadge(user.rank)}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/?user=${user.author}&days=${days}`}
            scroll={false}
            prefetch={true}
            className="flex items-center gap-3 group/link after:absolute after:inset-0"
          >
            <Avatar className="h-10 w-10 border border-zinc-800 grayscale group-hover/link:grayscale-0 group-hover:grayscale-0 transition-all">
              <AvatarImage src={user.avatar_url} alt={user.author} />
              <AvatarFallback className="bg-zinc-900 text-zinc-500 text-xs">
                {user.author.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-zinc-300 group-hover/link:text-zinc-100 group-hover:text-zinc-100 transition-colors">
              {user.author}
            </span>
          </Link>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-right font-mono font-bold text-lg text-zinc-100">
        {user.total_score.toLocaleString()}
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <Badge variant="outline" className={`font-mono ${getScoreColor(user.metrics.pr_metrics)}`}>
          {user.metrics.pr_metrics}
        </Badge>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <Badge variant="outline" className={`font-mono ${getScoreColor(user.metrics.cycle_time)}`}>
          {user.metrics.cycle_time}
        </Badge>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <Badge variant="outline" className={`font-mono ${getScoreColor(user.metrics.pr_impact)}`}>
          {user.metrics.pr_impact}
        </Badge>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <Badge variant="outline" className={`font-mono ${getScoreColor(user.metrics.bugs_attribution)}`}>
          {user.metrics.bugs_attribution}
        </Badge>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <Badge variant="outline" className={`font-mono ${getScoreColor(user.metrics.maintenance)}`}>
          {user.metrics.maintenance}
        </Badge>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <Badge variant="outline" className={`font-mono ${getScoreColor(user.metrics.off_hours)}`}>
          {user.metrics.off_hours}
        </Badge>
      </td>
    </motion.tr>
  );
}
