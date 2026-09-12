import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { CostLevel } from "@/types/domain"
import { formatNumber, formatPercent, formatYears } from "@/utils/format"

type RecommendationCardProps = {
  rank?: number
  title: string
  category?: string
  reductionPercent: number
  costLevel: CostLevel | string
  paybackYears: number | null
  /** Deterministic score (0–100) from the recommendation service. */
  score: number
  reason?: string
  onSelect?: () => void
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  )
}

export default function RecommendationCard({
  rank,
  title,
  category,
  reductionPercent,
  costLevel,
  paybackYears,
  score,
  reason,
  onSelect,
}: RecommendationCardProps) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {rank != null && <p className="text-xs text-muted-foreground">Priority #{rank}</p>}
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          {category && (
            <Badge variant="muted" className="w-fit">
              {category}
            </Badge>
          )}
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl font-semibold">{formatNumber(score, 0)}</p>
          <p className="text-xs text-muted-foreground">Score</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <Metric label="Est. reduction" value={formatPercent(reductionPercent)} />
        <Metric label="Cost" value={costLevel.charAt(0) + costLevel.slice(1).toLowerCase()} />
        <Metric label="Payback" value={formatYears(paybackYears)} />
      </dl>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Estimates — not guaranteed savings.</p>
        {onSelect && (
          <Button variant="outline" size="sm" onClick={onSelect}>
            Simulate
          </Button>
        )}
      </div>
    </Card>
  )
}
