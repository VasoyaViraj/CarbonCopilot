import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon, Flame } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FactorySelect from "@/components/FactorySelect"
import HotspotCard from "@/components/HotspotCard"
import DashboardFilters from "@/components/dashboard/DashboardFilters"
import DashboardNotices from "@/components/dashboard/DashboardNotices"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import NotConnectedNotice from "@/components/feedback/NotConnectedNotice"
import HotspotDetailPanel from "@/components/hotspots/HotspotDetailPanel"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useHotspotDetail, useHotspots } from "@/hooks/useHotspots"
import type { HotspotThresholds } from "@/services/hotspotService"
import { cn } from "@/lib/utils"
import { DEFAULT_DASHBOARD_FILTERS, toSummaryQuery, type DashboardFilterValue } from "@/utils/dashboardPeriods"
import { formatNumber, formatPercent } from "@/utils/format"

const ALL_DATA: DashboardFilterValue = { period: "all", source: "" }

const describeThresholds = ({ critical, high, medium }: HotspotThresholds) =>
  `Severity: critical above ${critical}%, high ${high}–${critical}%, medium ${medium}–${high}%, low below ${medium}%.`

export default function HotspotsPage() {
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  const [filters, setFilters] = useState<DashboardFilterValue>(DEFAULT_DASHBOARD_FILTERS)
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null)
  const query = useMemo(() => toSummaryQuery(filters), [filters])
  const factoryId = factory?.id ?? null

  const { ranking, loading, error: rankingError, reload: reloadRanking } = useHotspots(factoryId, query)
  const detailState = useHotspotDetail(factoryId, selectedProcessId, query)
  // Never show a ranking or detail loaded for a previously selected factory or process.
  const current = ranking && ranking.factory.id === factoryId ? ranking : null
  const detail =
    detailState.detail && detailState.detail.factory.id === factoryId && detailState.detail.process.id === selectedProcessId
      ? detailState.detail
      : null
  const isFiltered = filters.period !== ALL_DATA.period || filters.source !== ALL_DATA.source

  const detailRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selectedProcessId != null) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [selectedProcessId])

  const changeFactory = (id: number) => {
    setSelectedProcessId(null)
    selectFactory(id)
  }

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
          description="Hotspots are ranked from the emissions of a factory's processes."
          action={
            <Link to="/factory" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Factory Setup
            </Link>
          }
        />
      </Card>
    )
  } else if (!current) {
    content = rankingError ? (
      <Card>
        <ErrorState title="Hotspots are unavailable" message={rankingError} onRetry={reloadRanking} />
      </Card>
    ) : (
      <LoadingState label="Ranking processes…" />
    )
  } else if (current.hotspots.length === 0) {
    content = (
      <>
        <DashboardNotices warnings={current.warnings} refreshError={rankingError} onRetry={reloadRanking} />
        <Card>
          <EmptyState
            icon={Flame}
            title={
              current.activityCount > 0
                ? "No calculated emissions to rank"
                : isFiltered
                  ? "No emissions for these filters"
                  : "No emissions recorded yet"
            }
            description="Hotspots appear once activities with calculated emissions exist for the selected period and data source."
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
      </>
    )
  } else {
    const unit = current.co2eUnit
    const [top] = current.hotspots
    content = (
      <div aria-busy={loading} className={cn("transition-opacity", loading && "opacity-60")}>
        <DashboardNotices warnings={current.warnings} refreshError={rankingError} onRetry={reloadRanking} />
        <p className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{top.process}</span> is the largest emission source:{" "}
          {formatNumber(top.emission)} {unit}, {formatPercent(top.percentage)} of {formatNumber(current.totalEmission)} {unit} across{" "}
          {current.hotspots.length} processes.
        </p>
        <div className="mb-4">
          <NotConnectedNotice>AI Analysis becomes available once the AI service is connected. The ranking is calculated deterministically.</NotConnectedNotice>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {current.hotspots.map((hotspot) => (
            <HotspotCard
              key={hotspot.processId}
              rank={hotspot.rank}
              process={hotspot.process}
              emission={hotspot.emission}
              unit={unit}
              percentage={hotspot.percentage}
              severity={hotspot.severity}
              selected={hotspot.processId === selectedProcessId}
              onDetails={() => setSelectedProcessId((id) => (id === hotspot.processId ? null : hotspot.processId))}
              analyzeUnavailable
            />
          ))}
        </div>
        {selectedProcessId != null && (
          <div ref={detailRef} className="mt-6 scroll-mt-6">
            <HotspotDetailPanel
              detail={detail}
              loading={detailState.loading}
              error={detailState.error}
              onRetry={detailState.reload}
              onClose={() => setSelectedProcessId(null)}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Hotspot Analysis"
        description={`Processes ranked by their share of total estimated emissions.${current ? ` ${describeThresholds(current.thresholds)}` : ""}`}
        actions={
          factory && (
            <>
              <FactorySelect factories={factories} value={factory.id} onChange={changeFactory} />
              <DashboardFilters value={filters} onChange={setFilters} />
            </>
          )
        }
      />
      {content}
    </>
  )
}
