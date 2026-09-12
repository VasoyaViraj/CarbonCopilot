import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"

type DashboardCardProps = {
  label: string
  value: string
  unit?: string
  hint?: string
  icon?: LucideIcon
}

/** KPI stat tile. Values arrive pre-calculated from the API; this component only displays them. */
export default function DashboardCard({ label, value, unit, hint, icon: Icon }: DashboardCardProps) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </div>
      <p className="font-heading text-2xl font-semibold tracking-tight">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
