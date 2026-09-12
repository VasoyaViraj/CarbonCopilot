import { useState } from "react"
import ChartContainer from "@/charts/ChartContainer"
import TrendLineChart from "@/charts/TrendLineChart"
import { Select } from "@/components/ui/input"
import { formatPeriod } from "@/utils/format"

export type EnergySeries = {
  activityType: string
  label: string
  /** Canonical unit of the activity type; series in different units are never combined. */
  unit: string
  history: { period: string; quantity: number }[]
}

type EnergyConsumptionChartProps = {
  series: EnergySeries[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

/** Consumption over time for one energy/fuel type at a time, since their units differ. */
export default function EnergyConsumptionChart({ series, loading, error, onRetry }: EnergyConsumptionChartProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const current = series.find((entry) => entry.activityType === selectedType) ?? series[0]

  const typeSelector =
    series.length > 1 && current ? (
      <Select
        aria-label="Energy type"
        className="h-8 w-40"
        value={current.activityType}
        onChange={(event) => setSelectedType(event.target.value)}
      >
        {series.map((entry) => (
          <option key={entry.activityType} value={entry.activityType}>
            {entry.label}
          </option>
        ))}
      </Select>
    ) : null

  return (
    <ChartContainer
      title="Energy consumption"
      description={current ? `${current.label} · ${current.unit}` : "Energy and fuel use"}
      actions={typeSelector}
      loading={loading}
      error={error}
      onRetry={onRetry}
      isEmpty={!current}
      emptyMessage="No energy or fuel consumption recorded for this period."
    >
      {current && (
        <TrendLineChart
          data={current.history.map((point) => ({ label: formatPeriod(point.period), value: point.quantity }))}
          unit={current.unit}
        />
      )}
    </ChartContainer>
  )
}
