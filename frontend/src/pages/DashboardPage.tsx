import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon, Leaf } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import DashboardFilters from "@/components/dashboard/DashboardFilters"
import DashboardNotices from "@/components/dashboard/DashboardNotices"
import EmissionKpiCards from "@/components/dashboard/EmissionKpiCards"
import EnergyConsumptionChart from "@/components/dashboard/EnergyConsumptionChart"
import ChartContainer from "@/charts/ChartContainer"
import CategoryBarChart from "@/charts/CategoryBarChart"
import TrendLineChart from "@/charts/TrendLineChart"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/input"
import { useEmissionSummary } from "@/hooks/useEmissionSummary"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import type { EmissionSummary } from "@/services/emissionService"
import { cn } from "@/lib/utils"
import { DEFAULT_DASHBOARD_FILTERS, toSummaryQuery, type DashboardFilterValue } from "@/utils/dashboardPeriods"
import { formatNumber, formatPeriod } from "@/utils/format"

const ALL_DATA: DashboardFilterValue = { period: "all", source: "" }

function DashboardContent({ summary }: { summary: EmissionSummary }) {
  const unit = summary.co2eUnit
  const { totals } = summary
  const noEmissions = totals.emissionCount === 0
  const noEmissionsMessage = "No calculated emissions for this period yet."

  // The API reports why production or intensity is unavailable; the cards say so rather than showing 0.
  const mixedProduction = summary.warnings.some((warning) => warning.code === "MIXED_PRODUCTION_UNITS")
  const hasProduction = summary.production.unit != null && summary.production.quantity != null

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
        production={{
          value: hasProduction ? summary.production.quantity : null,
          unit: summary.production.unit,
          hint: mixedProduction ? "Recorded in incompatible units" : hasProduction ? undefined : "No production recorded for this period",
        }}
        intensity={{
          value: summary.intensity.value,
          unit: summary.intensity.unit,
          hint: summary.intensity.value != null ? undefined : mixedProduction ? "Needs production recorded in one unit" : "Needs recorded production",
        }}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Emissions by process" description={unit} isEmpty={noEmissions} emptyMessage={noEmissionsMessage}>
          <CategoryBarChart
            data={summary.byProcess.map((entry) => ({ label: entry.process, value: entry.co2e, share: entry.percentage }))}
            unit={unit}
          />
        </ChartContainer>
        <ChartContainer
          title="Emissions by source"
          description={unit}
          isEmpty={summary.bySource.length === 0}
          emptyMessage={noEmissionsMessage}
        >
          <CategoryBarChart
            data={summary.bySource.map((entry) => ({ label: entry.label, value: entry.co2e, share: entry.percentage }))}
            unit={unit}
          />
        </ChartContainer>
        <ChartContainer
          title="Historical emissions"
          description={`${summary.filters.granularity === "day" ? "Daily" : "Monthly"} ${unit}`}
          isEmpty={noEmissions || summary.history.length === 0}
          emptyMessage={noEmissionsMessage}
        >
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
  const isFiltered = filters.period !== ALL_DATA.period || filters.source !== ALL_DATA.source

  let content
  if (status === "loading") {
    content = <LoadingState label="Loading factories…" />
  } else if (status === "error") {
    content = <ErrorState message={error ?? undefined} onRetry={reload} />
  } else if (!factory) {
    content = (
      <Card>
        <EmptyState
          icon={FactoryIcon}
          title="Set up a factory first"
          description="The dashboard summarises emissions calculated from a factory's recorded activities."
          action={
            <Link to="/factory" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Factory Setup
            </Link>
          }
        />
      </Card>
    )
  } else if (!current) {
    content = summaryError ? (
      <Card>
        <ErrorState title="Emission data is unavailable" message={summaryError} onRetry={reloadSummary} />
      </Card>
    ) : (
      <LoadingState label="Loading emission summary…" />
    )
  } else {
    content = (
      <div aria-busy={loading} className={cn("transition-opacity", loading && "opacity-60")}>
        <DashboardNotices warnings={current.warnings} refreshError={summaryError} onRetry={reloadSummary} />
        {current.totals.activityCount === 0 ? (
          <Card>
            <EmptyState
              icon={Leaf}
              title={isFiltered ? "No emissions for these filters" : "No emissions recorded yet"}
              description={
                isFiltered
                  ? "Nothing was recorded for the selected period and data source."
                  : "Record activities manually, import a CSV or run the simulator. Emissions are calculated as data arrives."
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {isFiltered && (
                    <Button variant="outline" size="sm" onClick={() => setFilters(ALL_DATA)}>
                      Show all data
                    </Button>
                  )}
                  <Link to="/data" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open Data Input
                  </Link>
                </div>
              }
            />
          </Card>
        ) : (
          <DashboardContent summary={current} />
        )}
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
