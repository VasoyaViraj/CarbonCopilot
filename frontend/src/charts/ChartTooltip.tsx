import { formatNumber } from "@/utils/format"

type ChartTooltipProps = {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<{ value?: unknown }>
  unit: string
}

/** Tooltip body shared by all charts; text uses ink tokens, never the series color. */
export default function ChartTooltip({ active, label, payload, unit }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0].value)
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-popover-foreground">
        {formatNumber(value)} {unit}
      </p>
    </div>
  )
}
