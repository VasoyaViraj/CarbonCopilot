import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import ChartTooltip from "@/charts/ChartTooltip"
import { formatNumber } from "@/utils/format"

type TrendLineChartProps = {
  data: { label: string; value: number }[]
  unit: string
  color?: string
}

/** Single-series change over time: 2px line, crosshair tooltip, 8px active marker with surface ring. */
export default function TrendLineChart({ data, unit, color = "var(--chart-1)" }: TrendLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--chart-baseline)" }}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
        />
        <YAxis
          width={56}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
          tickFormatter={(value: number) => formatNumber(value, 0)}
        />
        <Tooltip cursor={{ stroke: "var(--chart-baseline)" }} content={<ChartTooltip unit={unit} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
