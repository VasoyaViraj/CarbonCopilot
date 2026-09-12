import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon, Flame } from "lucide-react"

import PageHeader from "@/components/PageHeader"
import FactorySelect from "@/components/FactorySelect"
import HotspotCard from "@/components/HotspotCard"
import AnomalySignal from "@/components/AnomalySignal"

import DashboardFilters from "@/components/dashboard/DashboardFilters"
import DashboardNotices from "@/components/dashboard/DashboardNotices"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import AiAnalysisPanel from "@/components/ai/AiAnalysisPanel"
import HotspotDetailPanel from "@/components/hotspots/HotspotDetailPanel"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

import { useAnomalySignal } from "@/hooks/useAnomalySignal"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useCopilotRequest } from "@/hooks/useCopilotRequest"
import { useHotspotDetail, useHotspots } from "@/hooks/useHotspots"

import type { HotspotThresholds } from "@/services/hotspotService"

import { cn } from "@/lib/utils"
import {
  DEFAULT_DASHBOARD_FILTERS,
  toSummaryQuery,
  type DashboardFilterValue,
} from "@/utils/dashboardPeriods"
import { formatNumber, formatPercent } from "@/utils/format"

const ALL_DATA: DashboardFilterValue = {
  period: "all",
  source: "",
}

const describeThresholds = ({
  critical,
  high,
  medium,
}: HotspotThresholds) =>
  `Severity: critical above ${critical}%, high ${high}–${critical}%, medium ${medium}–${high}%, low below ${medium}%.`

export default function HotspotsPage() {
  const {
    status,
    error,
    factories,
    factory,
    selectFactory,
    reload,
  } = useFactorySelection()

  const [filters, setFilters] =
    useState<DashboardFilterValue>(DEFAULT_DASHBOARD_FILTERS)

  const [selectedProcessId, setSelectedProcessId] =
    useState<number | null>(null)

  const query = useMemo(
    () => toSummaryQuery(filters),
    [filters],
  )

  const factoryId = factory?.id ?? null

  /*
   * AI Analysis of one hotspot: explains the deterministic ranking and
   * root-cause evidence; it never recalculates them.
   */
  const [analysisProcess, setAnalysisProcess] =
    useState<string | null>(null)
  const analysis = useCopilotRequest(factoryId)
  const analysisRef = useRef<HTMLDivElement>(null)

  /*
   * Main hotspot ranking.
   */
  const {
    ranking,
    loading,
    error: rankingError,
    reload: reloadRanking,
  } = useHotspots(factoryId, query)

  /*
   * AI/anomaly signal.
   *
   * This is kept as an additional signal on top of the
   * deterministic hotspot ranking.
   */
  const {
    signal,
    isLoading: signalLoading,
    error: signalError,
  } = useAnomalySignal(factoryId ?? undefined)

  /*
   * Detailed information for the selected process.
   */
  const detailState = useHotspotDetail(
    factoryId,
    selectedProcessId,
    query,
  )

  /*
   * Never show data loaded for a previously selected factory.
   */
  const current =
    ranking && ranking.factory.id === factoryId
      ? ranking
      : null

  /*
   * Never show detail data belonging to another factory/process.
   */
  const detail =
    detailState.detail &&
    detailState.detail.factory.id === factoryId &&
    detailState.detail.process.id === selectedProcessId
      ? detailState.detail
      : null

  const isFiltered =
    filters.period !== ALL_DATA.period ||
    filters.source !== ALL_DATA.source

  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedProcessId != null) {
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [selectedProcessId])

  useEffect(() => {
    if (analysisProcess != null) {
      analysisRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [analysisProcess])

  /*
   * Changing factory also clears the selected process and AI analysis.
   */
  const changeFactory = (id: number) => {
    setSelectedProcessId(null)
    setAnalysisProcess(null)
    analysis.reset()
    selectFactory(id)
  }

  const analyze = (process: string) => {
    setAnalysisProcess(process)
    void analysis.ask(`Why is ${process} a hotspot?`)
  }

  const closeAnalysis = () => {
    setAnalysisProcess(null)
    analysis.reset()
  }

  let content

  /*
   * 1. Loading factories
   */
  if (status === "loading") {
    content = <LoadingState label="Loading factories…" />
  }

  /*
   * 2. Factory loading error
   */
  else if (status === "error") {
    content = (
      <ErrorState
        message={error ?? undefined}
        onRetry={reload}
      />
    )
  }

  /*
   * 3. No factory configured
   */
  else if (!factory) {
    content = (
      <Card>
        <EmptyState
          icon={FactoryIcon}
          title="Set up a factory first"
          description="Hotspots are ranked from the emissions of a factory's processes."
          action={
            <Link
              to="/factory"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
              })}
            >
              Open Factory Setup
            </Link>
          }
        />
      </Card>
    )
  }

  /*
   * 4. Ranking loading/error
   */
  else if (!current) {
    content = rankingError ? (
      <Card>
        <ErrorState
          title="Hotspots are unavailable"
          message={rankingError}
          onRetry={reloadRanking}
        />
      </Card>
    ) : (
      <LoadingState label="Ranking processes…" />
    )
  }

  /*
   * 5. Ranking exists but contains no hotspots.
   */
  else if (current.hotspots.length === 0) {
    content = (
      <>
        <DashboardNotices
          warnings={current.warnings}
          refreshError={rankingError}
          onRetry={reloadRanking}
        />

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters(ALL_DATA)}
                  >
                    Show all data
                  </Button>
                )}

                <Link
                  to="/data"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
                >
                  Open Data Input
                </Link>
              </div>
            }
          />
        </Card>
      </>
    )
  }

  /*
   * 6. Normal hotspot ranking.
   */
  else {
    const unit = current.co2eUnit
    const [top] = current.hotspots

    content = (
      <div
        aria-busy={loading}
        className={cn(
          "transition-opacity",
          loading && "opacity-60",
        )}
      >
        <DashboardNotices
          warnings={current.warnings}
          refreshError={rankingError}
          onRetry={reloadRanking}
        />

        {/*
         * Anomaly signal is an additional analysis layer.
         *
         * It does NOT replace the deterministic ranking.
         */}
        <div className="mb-6">
          <AnomalySignal
            signal={signal}
            isLoading={signalLoading}
            error={signalError}
          />
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {top.process}
          </span>{" "}
          is the largest emission source:{" "}
          {formatNumber(top.emission)} {unit},{" "}
          {formatPercent(top.percentage)} of{" "}
          {formatNumber(current.totalEmission)} {unit} across{" "}
          {current.hotspots.length} processes.
        </p>

        {analysisProcess != null && (
          <div
            ref={analysisRef}
            className="mb-6 scroll-mt-6"
          >
            <AiAnalysisPanel
              title={`AI analysis: ${analysisProcess}`}
              description="Separates recorded data, derived metrics, unverified hypotheses and missing information. The ranking itself is calculated deterministically."
              loading={analysis.loading}
              error={analysis.error}
              response={analysis.response}
              loadingLabel={`Analyzing ${analysisProcess}…`}
              onRetry={() => analyze(analysisProcess)}
              onClose={closeAnalysis}
            />
          </div>
        )}

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
              selected={
                hotspot.processId === selectedProcessId
              }
              onDetails={() =>
                setSelectedProcessId((id) =>
                  id === hotspot.processId
                    ? null
                    : hotspot.processId,
                )
              }
              onAnalyze={() => analyze(hotspot.process)}
            />
          ))}
        </div>

        {selectedProcessId != null && (
          <div
            ref={detailRef}
            className="mt-6 scroll-mt-6"
          >
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
        description={`Processes ranked by their share of total estimated emissions.${
          current
            ? ` ${describeThresholds(current.thresholds)}`
            : ""
        }`}
        actions={
          factory && (
            <>
              <FactorySelect
                factories={factories}
                value={factory.id}
                onChange={changeFactory}
              />

              <DashboardFilters
                value={filters}
                onChange={setFilters}
              />
            </>
          )
        }
      />

      {content}
    </>
  )
}