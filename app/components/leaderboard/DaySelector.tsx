"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS_OPTIONS = [7, 15, 30, 60, 90];

export function DaySelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentDays = searchParams.get('days') || '90';

  const handleValueChange = (val: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('days', val);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-400 font-medium">Time Window:</span>
      <Select
        value={currentDays}
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-[140px] md:w-[160px] bg-zinc-950 border-zinc-800 text-zinc-100 font-medium h-9 hover:bg-zinc-900 transition-colors">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          {DAYS_OPTIONS.map((days) => (
            <SelectItem
              key={days}
              value={days.toString()}
              className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
            >
              Last {days} days
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
