import { useAppStore } from '@/store/useAppStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS_OPTIONS = [7, 15, 30, 60, 90];

export function DaySelector() {
  const { daysWindow, setDaysWindow } = useAppStore();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-400 font-medium">Time Window:</span>
      <Select
        value={daysWindow.toString()}
        onValueChange={(val) => setDaysWindow(parseInt(val, 10))}
      >
        <SelectTrigger className="w-[120px] bg-zinc-900 border-zinc-800 text-zinc-100 font-medium h-9">
          <SelectValue placeholder="Select days" />
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
