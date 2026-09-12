import { Select } from "@/components/ui/input"
import type { ActivitySource } from "@/services/activityService"
import { PERIOD_OPTIONS, type DashboardFilterValue, type DashboardPeriod } from "@/utils/dashboardPeriods"

const SOURCE_OPTIONS: { value: "" | ActivitySource; label: string }[] = [
  { value: "", label: "All data sources" },
  { value: "MANUAL", label: "Manual entries" },
  { value: "CSV", label: "CSV imports" },
  { value: "SIMULATION", label: "Simulated readings" },
]

type DashboardFiltersProps = {
  value: DashboardFilterValue
  onChange: (value: DashboardFilterValue) => void
}

/** Period and data-source filters; the API applies them when aggregating. */
export default function DashboardFilters({ value, onChange }: DashboardFiltersProps) {
  return (
    <>
      <Select
        aria-label="Period"
        className="w-40"
        value={value.period}
        onChange={(event) => onChange({ ...value, period: event.target.value as DashboardPeriod })}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Data source"
        className="w-44"
        value={value.source}
        onChange={(event) => onChange({ ...value, source: event.target.value as "" | ActivitySource })}
      >
        {SOURCE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </>
  )
}
