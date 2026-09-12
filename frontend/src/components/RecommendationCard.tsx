import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { formatNumber, formatPercent, formatYears } from "@/utils/format"

/** One BR-06 component as returned by the API: its 0–100 value and its weight in the score. */
export type ScorePart = { label: string; value: number; weight: number }

type RecommendationCardProps = {
  rank?: number
  title: string
  category?: string
  /** What the intervention applies to, e.g. "Furnace" or "Factory-wide". */
  target?: string
  /** Deterministic score (0–100) from the recommendation service. */
  score: number
  /** Reduction of the targeted emissions (%). */
  reductionPercent: number | null
  costLevel: string | null
  paybackYears: number | null
  /** Estimated CO2e avoided per year and its share of the factory's emissions. */
  savings?: { value: number | null; unit: string; shareOfFactory: number | null }
  reason?: string | null
  status?: string
  breakdown?: ScorePart[]
  assumptions?: string[]
  onSelect?: () => void
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

export default function RecommendationCard({
  rank,
  title,
  category,
  target,
  score,
  reductionPercent,
  costLevel,
  paybackYears,
  savings,
  reason,
  status,
  breakdown,
  assumptions = [],
  onSelect,
}: RecommendationCardProps) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {rank != null && <p className="text-xs text-muted-foreground">Priority #{rank}</p>}
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          <div className="flex flex-wrap gap-1.5">
            {category && (
              <Badge variant="muted" className="w-fit">
                {titleCase(category)}
              </Badge>
            )}
            {target && (
              <Badge variant="outline" className="w-fit">
                {target}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-2xl font-semibold">{formatNumber(score, 0)}</p>
          <p className="text-xs text-muted-foreground">Score</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Metric label="Reduction" value={reductionPercent == null ? "N/A" : formatPercent(reductionPercent)} hint="of targeted emissions" />
        {savings && (
          <Metric
            label="CO2e saved"
            value={savings.value == null ? "N/A" : `${formatNumber(savings.value, 1)} ${savings.unit}`}
            hint={savings.shareOfFactory == null ? undefined : `${formatPercent(savings.shareOfFactory, 2)} of factory emissions`}
          />
        )}
        <Metric label="Cost" value={costLevel ? titleCase(costLevel) : "N/A"} />
        <Metric label="Payback" value={formatYears(paybackYears)} />
      </dl>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
      {breakdown && breakdown.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">How the score is calculated</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {breakdown.map((part) => (
              <li key={part.label}>
                <div className="flex justify-between gap-2 text-xs">
                  <span>
                    {part.label} <span className="text-muted-foreground">· weight {formatPercent(part.weight * 100, 0)}</span>
                  </span>
                  <span className="font-medium">{formatNumber(part.value, 0)}/100</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, part.value))}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {assumptions.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
              {assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          )}
        </details>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {status && status !== "PENDING" ? `${titleCase(status)} · ` : ""}Estimates, not guaranteed savings.
        </p>
        {onSelect && (
          <Button variant="outline" size="sm" onClick={onSelect}>
            Simulate
          </Button>
        )}
      </div>
    </Card>
  )
}
