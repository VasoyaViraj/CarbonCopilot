import { useMemo, useState } from "react"
import { Factory as FactoryIcon } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import DashboardFilters from "@/components/dashboard/DashboardFilters"
import EmissionKpiCards from "@/components/dashboard/EmissionKpiCards"
import EnergyConsumptionChart from "@/components/dashboard/EnergyConsumptionChart"
import ChartContainer from "@/charts/ChartContainer"
import CategoryBarChart from "@/charts/CategoryBarChart"
import TrendLineChart from "@/charts/TrendLineChart"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/input"
import { useEmissionSummary } from "@/hooks/useEmissionSummary"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import type { EmissionSummary } from "@/services/emissionService"
import { cn } from "@/lib/utils"
import { DEFAULT_DASHBOARD_FILTERS, toSummaryQuery, type DashboardFilterValue } from "@/utils/dashboardPeriods"
import { formatNumber, formatPeriod } from "@/utils/format"

function DashboardContent({ summary }: { summary: EmissionSummary }) {
  const unit = summary.co2eUnit
  const { totals } = summary

  return (
    <>
      <EmissionKpiCards
        total={{
          value: totals.co2e,
          unit,
          // Simulated readings are always labelled (BR-12).
          hint:
            totals.simulatedCo2e > 0
              ? `Includes ${formatNumber(totals.simulatedCo2e)} ${unit} from simulated readings`
              : `From ${formatNumber(totals.emissionCount)} calculated activities`,
        }}
        production={{ value: summary.production.quantity, unit: summary.production.unit }}
        intensity={{ value: summary.intensity.value, unit: summary.intensity.unit }}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Emissions by process" description={unit}>
          <CategoryBarChart
            data={summary.byProcess.map((entry) => ({ label: entry.process, value: entry.co2e, share: entry.percentage }))}
            unit={unit}
          />
        </ChartContainer>
        <ChartContainer title="Emissions by source" description={unit}>
          <CategoryBarChart
            data={summary.bySource.map((entry) => ({ label: entry.label, value: entry.co2e, share: entry.percentage }))}
            unit={unit}
          />
        </ChartContainer>
        <ChartContainer title="Historical emissions" description={`${summary.filters.granularity === "day" ? "Daily" : "Monthly"} ${unit}`}>
          <TrendLineChart
            data={summary.history.map((point) => ({ label: formatPeriod(point.period), value: point.co2e }))}
            unit={unit}
          />
        </ChartContainer>
        <EnergyConsumptionChart series={summary.energy} />
      </div>
    </>
  )
}

export default function DashboardPage() {
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  const [filters, setFilters] = useState<DashboardFilterValue>(DEFAULT_DASHBOARD_FILTERS)
  const query = useMemo(() => toSummaryQuery(filters), [filters])
  const { summary, loading, error: summaryError, reload: reloadSummary } = useEmissionSummary(factory?.id ?? null, query)
  // A summary for a previously selected factory is never shown for the current one.
  const current = summary && summary.factory.id === factory?.id ? summary : null

  let content
  if (status === "loading") {
    content = <LoadingState label="Loading factories…" />
  } else if (status === "error") {
    content = <ErrorState message={error ?? undefined} onRetry={reload} />
  } else if (!factory) {
    content = (
      <Card>
        <EmptyState icon={FactoryIcon} title="No factory yet" description="Create a factory to see its carbon dashboard." />
      </Card>
    )
  } else if (!current) {
    content = summaryError ? (
      <Card>
        <ErrorState message={summaryError} onRetry={reloadSummary} />
      </Card>
    ) : (
      <LoadingState label="Loading emission summary…" />
    )
  } else {
    content = (
      <div aria-busy={loading} className={cn("transition-opacity", loading && "opacity-60")}>
        <DashboardContent summary={current} />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Carbon Dashboard"
        description="Estimated emissions calculated deterministically from activity data and emission factors."
        actions={
          factory && (
            <>
              {factories.length > 1 && (
                <Select aria-label="Factory" className="w-56" value={factory.id} onChange={(event) => selectFactory(Number(event.target.value))}>
                  {factories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              )}
              <DashboardFilters value={filters} onChange={setFilters} />
            </>
          )
        }
      />
      {content}
    </>
  )
}
