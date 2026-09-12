import { Factory, Gauge, Leaf } from "lucide-react"
import DashboardCard from "@/components/DashboardCard"
import { formatNumber } from "@/utils/format"

/** A pre-calculated API figure. `value: null` means the API could not determine it. */
export type KpiFigure = { value: number | null; unit: string | null; hint?: string }

type EmissionKpiCardsProps = {
  total: KpiFigure
  production: KpiFigure
  intensity: KpiFigure
}

const display = (figure: KpiFigure, digits: number) => (figure.value == null ? "N/A" : formatNumber(figure.value, digits))

/** Total emissions, production and emission intensity. Displays API values only — nothing is derived here. */
export default function EmissionKpiCards({ total, production, intensity }: EmissionKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <DashboardCard label="Total emissions" value={display(total, 2)} unit={total.unit ?? undefined} hint={total.hint} icon={Leaf} />
      <DashboardCard
        label="Production"
        value={display(production, 2)}
        unit={production.value == null ? undefined : (production.unit ?? undefined)}
        hint={production.hint}
        icon={Factory}
      />
      <DashboardCard
        label="Emission intensity"
        value={display(intensity, 4)}
        unit={intensity.value == null ? undefined : (intensity.unit ?? undefined)}
        hint={intensity.hint}
        icon={Gauge}
      />
    </div>
  )
}
