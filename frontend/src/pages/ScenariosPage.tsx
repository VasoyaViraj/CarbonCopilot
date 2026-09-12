import { useEffect, useMemo, useState } from "react"
import { Calculator, SlidersHorizontal } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

import PageHeader from "@/components/PageHeader"
import ScenarioSlider from "@/components/ScenarioSlider"
import DashboardCard from "@/components/DashboardCard"
import EmptyState from "@/components/feedback/EmptyState"
import FactorySelect from "@/components/FactorySelect"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useScenario } from "@/hooks/useScenario"
import { formatNumber, formatPercent, formatYears } from "@/utils/format"

const LEVERS = [
  { id: "recycledMaterialPercent", label: "Recycled material", description: "Share of virgin material replaced by recycled input." },
  { id: "energyEfficiencyPercent", label: "Energy efficiency", description: "Reduction in energy use from efficiency measures." },
  { id: "fuelReplacementPercent", label: "Fuel replacement", description: "Share of fossil fuel replaced by lower-carbon fuel." },
  { id: "wasteRecoveryPercent", label: "Waste recovery", description: "Share of waste recovered or reused." },
] as const

type LeverId = (typeof LEVERS)[number]["id"]

export default function ScenariosPage() {
  const { factory, factories, selectFactory } = useFactorySelection()
  
  const [levers, setLevers] = useState<Record<LeverId, number>>({
    recycledMaterialPercent: 0,
    energyEfficiencyPercent: 0,
    fuelReplacementPercent: 0,
    wasteRecoveryPercent: 0,
  })

  const { result, isLoading, error, calculate } = useScenario(factory?.id)

  useEffect(() => {
    if (!factory) return
    const timeout = window.setTimeout(() => {
      void calculate(levers)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [calculate, factory, levers])

  const handleCalculate = () => {
    void calculate(levers)
  }

  const chartData = useMemo(() => {
    if (!result) return []
    return [
      {
        name: "Emissions",
        Baseline: result.baselineEmission,
        Projected: result.projectedEmission,
      }
    ]
  }, [result])

  return (
    <>
      <PageHeader
        title="What-if Simulator"
        description="Adjust intervention assumptions and compare projected emissions against your baseline. Baseline data is never modified."
        actions={
          factory && (
            <FactorySelect
              factories={factories}
              value={factory.id}
              onChange={selectFactory}
            />
          )
        }
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
                disabled={!factory}
                onChange={(value) => setLevers((prev) => ({ ...prev, [lever.id]: value }))}
              />
            ))}
            <Button 
              onClick={handleCalculate} 
              disabled={isLoading || !factory} 
              className="w-fit"
            >
              <Calculator />
              {isLoading ? "Calculating..." : "Calculate scenario"}
            </Button>
            {error && (
              <div className="text-sm text-destructive mt-2">{error}</div>
            )}
          </CardContent>
        </Card>
        
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardCard 
              label="Current" 
              value={result ? formatNumber(result.baselineEmission) : "—"} 
              unit={result?.unit || "tCO2e"} 
            />
            <DashboardCard 
              label="Projected" 
              value={result ? formatNumber(result.projectedEmission) : "—"} 
              unit={result?.unit || "tCO2e"} 
            />
            <DashboardCard 
              label="Reduction" 
              value={result ? formatNumber(result.reductionAmount) : "—"} 
              unit={result?.unit || "tCO2e"} 
            />
            <DashboardCard 
              label="Reduction %" 
              value={result ? formatPercent(result.reductionPercent) : "—"} 
            />
          </div>
          
          <Card className="flex-1 flex flex-col min-h-[350px]">
            {!result ? (
              <EmptyState
                icon={SlidersHorizontal}
                title="No scenario calculated"
                description="Run a scenario to compare baseline and projected emissions, cost, savings and payback."
              />
            ) : (
              <CardContent className="flex-1 pt-6 flex flex-col gap-6">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${formatNumber(Number(value))} ${result.unit}`, '']} />
                      <Legend />
                      <Bar dataKey="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Projected" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Est. Cost</p>
                    <p className="font-semibold">${formatNumber(result.estimatedCost)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Est. Savings (Annual)</p>
                    <p className="font-semibold">${formatNumber(result.estimatedSavings)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payback Period</p>
                    <p className="font-semibold">{formatYears(result.paybackPeriod)}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
