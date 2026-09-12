import { X } from "lucide-react"
import ChartContainer from "@/charts/ChartContainer"
import CategoryBarChart from "@/charts/CategoryBarChart"
import TrendLineChart from "@/charts/TrendLineChart"
import DashboardCard from "@/components/DashboardCard"
import SeverityBadge from "@/components/SeverityBadge"
import DashboardNotices from "@/components/dashboard/DashboardNotices"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { HotspotDetail } from "@/services/hotspotService"
import { formatNumber, formatPercent, formatPeriod } from "@/utils/format"

type HotspotDetailPanelProps = {
  detail: HotspotDetail | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onClose: () => void
}

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

function DetailBody({ detail }: { detail: HotspotDetail }) {
  const unit = detail.co2eUnit
  const { hotspot, intensity } = detail
  const noEmissionsMessage = "No calculated emissions for this process in this period."
  // The intensity card already explains missing production, so only other warnings are listed.
  const warnings = detail.warnings.filter((warning) => warning.code !== "NO_PRODUCTION")

  return (
    <div className="flex flex-col gap-6">
      {detail.process.description && <p className="text-sm text-muted-foreground">{detail.process.description}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <DashboardCard
          label="Process emissions"
          value={formatNumber(detail.emission)}
          unit={unit}
          hint={
            detail.simulatedEmission > 0
              ? `Includes ${formatNumber(detail.simulatedEmission)} ${unit} from simulated readings`
              : `From ${formatNumber(detail.activityCount)} activities`
          }
        />
        <DashboardCard
          label="Share of factory emissions"
          value={hotspot ? formatPercent(hotspot.percentage) : "N/A"}
          hint={hotspot ? `Rank #${hotspot.rank} of ${detail.rankedProcessCount} processes` : "No emissions to rank in this period"}
        />
        <DashboardCard
          label="Emission intensity"
          value={intensity.value == null ? "N/A" : formatNumber(intensity.value, 4)}
          unit={intensity.value == null ? undefined : (intensity.unit ?? undefined)}
          hint={intensity.value == null ? "Needs production recorded for this process" : undefined}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer
          title="What drives it"
          description={`${unit} by emission source · share of this process`}
          isEmpty={detail.drivers.length === 0}
          emptyMessage={noEmissionsMessage}
        >
          <CategoryBarChart
            data={detail.drivers.map((driver) => ({ label: driver.label, value: driver.co2e, share: driver.percentage }))}
            unit={unit}
          />
        </ChartContainer>
        <ChartContainer
          title="Monthly emissions"
          description={unit}
          isEmpty={detail.emission === 0 || detail.history.length === 0}
          emptyMessage={noEmissionsMessage}
        >
          <TrendLineChart data={detail.history.map((point) => ({ label: formatPeriod(point.period), value: point.co2e }))} unit={unit} />
        </ChartContainer>
      </div>
      <DashboardNotices warnings={warnings} />
    </div>
  )
}

/** Deterministic breakdown of one hotspot: its share, what drives it and how it changed over time. */
export default function HotspotDetailPanel({ detail, loading, error, onRetry, onClose }: HotspotDetailPanelProps) {
  let body
  if (detail) body = <DetailBody detail={detail} />
  else if (error) body = <ErrorState message={error} onRetry={onRetry} />
  else body = <LoadingState label="Loading process details…" />

  return (
    <Card id="hotspot-detail" aria-busy={loading}>
      <CardHeader>
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {detail?.process.name ?? "Process details"}
            {detail?.hotspot && <SeverityBadge severity={detail.hotspot.severity} />}
          </CardTitle>
          <CardDescription className="mt-0.5">
            {detail?.process.processType ? `${titleCase(detail.process.processType)} process · ` : ""}
            Calculated from stored emissions
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X /> Close
        </Button>
      </CardHeader>
      <CardContent className={cn("transition-opacity", loading && detail && "opacity-60")}>{body}</CardContent>
    </Card>
  )
}
