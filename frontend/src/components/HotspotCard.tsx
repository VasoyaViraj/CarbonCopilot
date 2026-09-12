import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import SeverityBadge from "@/components/SeverityBadge"
import { SEVERITY_STYLES } from "@/components/severity"
import { cn } from "@/lib/utils"
import type { Severity } from "@/types/domain"
import { formatNumber, formatPercent } from "@/utils/format"

type HotspotCardProps = {
  rank: number
  process: string
  emission: number
  unit: string
  /** Contribution percentage as returned by the hotspot API. */
  percentage: number
  severity: Severity
  /** Highlights the card whose details are open. */
  selected?: boolean
  onDetails?: () => void
  onAnalyze?: () => void
  /** Shows the AI Analysis action disabled while the AI service is not connected. */
  analyzeUnavailable?: boolean
}

export default function HotspotCard({
  rank,
  process,
  emission,
  unit,
  percentage,
  severity,
  selected = false,
  onDetails,
  onAnalyze,
  analyzeUnavailable = false,
}: HotspotCardProps) {
  const barWidth = `${Math.min(100, Math.max(0, percentage))}%`
  const showAnalyze = !!onAnalyze || analyzeUnavailable
  return (
    <Card className={cn("flex flex-col gap-4 p-5", selected && "ring-2 ring-ring")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Rank #{rank}</p>
          <h3 className="font-heading text-base font-semibold">{process}</h3>
        </div>
        <SeverityBadge severity={severity} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-heading text-2xl font-semibold">
          {formatNumber(emission)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </p>
        <p className="text-sm font-medium">{formatPercent(percentage)} of total</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={`h-full rounded-full ${SEVERITY_STYLES[severity].dot}`} style={{ width: barWidth }} />
      </div>
      {(onDetails || showAnalyze) && (
        <div className="flex flex-wrap gap-2">
          {onDetails && (
            <Button variant="outline" size="sm" aria-expanded={selected} aria-controls="hotspot-detail" onClick={onDetails}>
              {selected ? "Hide details" : "Details"}
            </Button>
          )}
          {showAnalyze && (
            <Button size="sm" onClick={onAnalyze} disabled={!onAnalyze}>
              <Sparkles /> AI Analysis
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
