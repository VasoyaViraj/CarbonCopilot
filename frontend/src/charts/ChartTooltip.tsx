import { formatNumber, formatPercent } from "@/utils/format"

type ChartTooltipProps = {
  active?: boolean
  label?: string | number
  /** `payload.share` is an API-provided percentage of the total, shown when present. */
  payload?: ReadonlyArray<{ value?: unknown; payload?: { share?: number } }>
  unit: string
}

/** Tooltip body shared by all charts; text uses ink tokens, never the series color. */
export default function ChartTooltip({ active, label, payload, unit }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0].value)
  const share = payload[0].payload?.share
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-popover-foreground">
        {formatNumber(value)} {unit}
      </p>
      {share != null && <p className="text-muted-foreground">{formatPercent(share)} of total</p>}
    </div>
  )
}
