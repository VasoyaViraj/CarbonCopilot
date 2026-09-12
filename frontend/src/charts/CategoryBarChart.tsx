import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import ChartTooltip from "@/charts/ChartTooltip"
import { formatNumber } from "@/utils/format"

type CategoryBarChartProps = {
  /** `share` (optional) is the API-calculated percentage of the total, shown in the tooltip. */
  data: { label: string; value: number; share?: number }[]
  unit: string
  /** Single-series chart: one categorical slot; the card title names the series. */
  color?: string
}

/** Horizontal ranked bars (magnitude by category). Thin 20px bars, 4px rounded data-end. */
export default function CategoryBarChart({ data, unit, color = "var(--chart-1)" }: CategoryBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={{ stroke: "var(--chart-baseline)" }}
          tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
          tickFormatter={(value: number) => formatNumber(value, 0)}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={96}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip unit={unit} />} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
          <LabelList
            dataKey="value"
            position="right"
            fill="var(--muted-foreground)"
            fontSize={12}
            formatter={(value) => formatNumber(Number(value))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
