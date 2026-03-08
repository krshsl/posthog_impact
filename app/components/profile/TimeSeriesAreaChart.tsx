import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import type { TimeSeriesEntry } from "@/lib/types"

interface TimeSeriesAreaChartProps {
  data: TimeSeriesEntry[];
  title: string;
  description?: string;
  dataKeys: { key: keyof TimeSeriesEntry['raw_stats']; label: string; color: string }[];
}

export function TimeSeriesAreaChart({ data, title, description, dataKeys }: TimeSeriesAreaChartProps) {
  // Convert strictly to the shape expected by the chart (flatten raw_stats for easy mapping)
  const chartData = data.map((point) => ({
    date: point.date,
    ...point.raw_stats,
  }));

  // Build the dynamic config for shadcn
  const chartConfig = dataKeys.reduce((acc, curr, index) => {
    acc[curr.key] = {
      label: curr.label,
      color: curr.color,
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <Card className="flex flex-col border-zinc-800/60 bg-zinc-950/50 h-full shadow-lg overflow-hidden">
      <CardHeader className="pb-4 border-b border-zinc-800/40">
        <CardTitle className="text-zinc-100 font-semibold tracking-tight">{title}</CardTitle>
        {description && <CardDescription className="text-zinc-400">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pt-6 px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="h-full min-h-[300px] w-full">
          <AreaChart
            data={chartData}
            margin={{ left: -20, right: 10, top: 10, bottom: 0 }}
          >
            <defs>
              {dataKeys.map((k) => (
                <linearGradient key={k.key} id={`fill${k.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={k.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={k.color} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
              stroke="#a1a1aa"
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              stroke="#a1a1aa"
              fontSize={12}
            />
            <ChartTooltip
              cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            {dataKeys.map((k) => (
              <Area
                key={k.key}
                type="natural"
                dataKey={k.key}
                stroke={k.color}
                strokeWidth={2}
                fill={`url(#fill${k.key})`}
                fillOpacity={1}
                stackId="a"
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
