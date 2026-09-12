import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import ScenarioSlider from "@/components/ScenarioSlider"
import DashboardCard from "@/components/DashboardCard"
import EmptyState from "@/components/feedback/EmptyState"
import NotConnectedNotice from "@/components/feedback/NotConnectedNotice"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const LEVERS = [
  { id: "recycledMaterialPercent", label: "Recycled material", description: "Share of virgin material replaced by recycled input." },
  { id: "energyEfficiencyPercent", label: "Energy efficiency", description: "Reduction in energy use from efficiency measures." },
  { id: "fuelReplacementPercent", label: "Fuel replacement", description: "Share of fossil fuel replaced by lower-carbon fuel." },
  { id: "wasteRecoveryPercent", label: "Waste recovery", description: "Share of waste recovered or reused." },
] as const

type LeverId = (typeof LEVERS)[number]["id"]

export default function ScenariosPage() {
  const [levers, setLevers] = useState<Record<LeverId, number>>({
    recycledMaterialPercent: 0,
    energyEfficiencyPercent: 0,
    fuelReplacementPercent: 0,
    wasteRecoveryPercent: 0,
  })

  return (
    <>
      <PageHeader
        title="What-if Simulator"
        description="Adjust intervention assumptions and compare projected emissions against your baseline. Baseline data is never modified."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Interventions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {LEVERS.map((lever) => (
              <ScenarioSlider
                key={lever.id}
                id={lever.id}
                label={lever.label}
                description={lever.description}
                value={levers[lever.id]}
                onChange={(value) => setLevers((prev) => ({ ...prev, [lever.id]: value }))}
              />
            ))}
            <Button disabled className="w-fit">
              Calculate scenario
            </Button>
            <NotConnectedNotice>Projections are calculated by the scenario API, which is not connected yet.</NotConnectedNotice>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardCard label="Current" value="—" unit="tCO2e" />
            <DashboardCard label="Projected" value="—" unit="tCO2e" />
            <DashboardCard label="Reduction" value="—" unit="tCO2e" />
            <DashboardCard label="Reduction %" value="—" />
          </div>
          <Card>
            <EmptyState
              icon={SlidersHorizontal}
              title="No scenario calculated"
              description="Run a scenario to compare baseline and projected emissions, cost, savings and payback."
            />
          </Card>
        </div>
      </div>
    </>
  )
}
