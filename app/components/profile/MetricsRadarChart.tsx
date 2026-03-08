import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import type { RawMetrics } from "@/lib/types"

interface MetricsRadarChartProps {
  metrics: RawMetrics;
}

const chartConfig = {
  score: {
    label: "Score",
    color: "#fafafa", // zinc-50
  },
} satisfies ChartConfig

export function MetricsRadarChart({ metrics }: MetricsRadarChartProps) {
  const chartData = [
    { metric: "PR Output", score: metrics.pr_metrics },
    { metric: "Cycle Time", score: metrics.cycle_time },
    { metric: "PR Impact", score: metrics.pr_impact },
    { metric: "Bugs Attr.", score: metrics.bugs_attribution },
    { metric: "Legacy Refactor", score: metrics.legacy_code },
    { metric: "Off-Hours", score: metrics.off_hours },
  ];

  return (
    <Card className="flex flex-col border-zinc-800/60 bg-zinc-950/50 h-full shadow-lg">
      <CardHeader className="items-center pb-4 border-b border-zinc-800/40">
        <CardTitle className="text-zinc-100 font-semibold tracking-tight">Skill Breakdown</CardTitle>
        <CardDescription className="text-zinc-400">0-100 normalized scores</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0 flex items-center justify-center p-0 sm:p-4 overflow-hidden">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[280px] sm:max-w-[420px]"
        >
          <RadarChart
            data={chartData}
            margin={{ top: 10, right: 60, bottom: 10, left: 60 }}
          >
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarGrid className="fill-zinc-800/[0.05] stroke-zinc-800/50" />
            <PolarAngleAxis
              dataKey="metric"
              tick={({ payload, x, y, cx, cy, index }: any) => {
                // Calculate position adjustment based on angle for better spacing
                const angle = (index * 60 - 90) * (Math.PI / 180);
                const radius = 10;
                const tx = x + Math.cos(angle) * radius;
                const ty = y + Math.sin(angle) * radius;

                return (
                  <text
                    x={tx}
                    y={ty}
                    textAnchor={x > cx ? "start" : x < cx ? "end" : "middle"}
                    dominantBaseline="central"
                    fill="#a1a1aa"
                    fontSize={11}
                    fontWeight={700}
                    className="tracking-tighter"
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: "#52525b", fontSize: 8 }}
              axisLine={false}
              orientation="middle"
            />
            <Radar
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0.2}
              stroke="var(--color-score)"
              strokeWidth={2}
              dot={{
                r: 4,
                fill: "var(--color-score)",
                fillOpacity: 1,
                stroke: "#fff",
                strokeWidth: 1
              }}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
