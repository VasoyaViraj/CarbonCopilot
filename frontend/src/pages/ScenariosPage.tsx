import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Link } from "react-router"
import { Bookmark, Calculator, Factory as FactoryIcon, Lock, SlidersHorizontal } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

import PageHeader from "@/components/PageHeader"
import ScenarioSlider from "@/components/ScenarioSlider"
import DashboardCard from "@/components/DashboardCard"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import FactorySelect from "@/components/FactorySelect"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import { useAuth } from "@/hooks/useAuth"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useSavedScenarios } from "@/hooks/useSavedScenarios"
import { useScenario } from "@/hooks/useScenario"
import { formatNumber, formatPercent, formatYears } from "@/utils/format"
import { ANALYSIS_RUNNERS, ROLE_LABELS } from "@/utils/roles"

const LEVERS = [
  { id: "recycledMaterialPercent", label: "Recycled material", description: "Share of virgin material replaced by recycled input." },
  { id: "energyEfficiencyPercent", label: "Energy efficiency", description: "Reduction in energy use from efficiency measures." },
  { id: "fuelReplacementPercent", label: "Fuel replacement", description: "Share of fossil fuel replaced by lower-carbon fuel." },
  { id: "wasteRecoveryPercent", label: "Waste recovery", description: "Share of waste recovered or reused." },
] as const

type LeverId = (typeof LEVERS)[number]["id"]

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })

export default function ScenariosPage() {
  const { status, error: factoriesError, factories, factory, selectFactory, reload } = useFactorySelection()
  const { user } = useAuth()
  // Saving is an analysis action; regulators review saved scenarios read-only.
  const canSave = !!user && ANALYSIS_RUNNERS.includes(user.role)

  const [levers, setLevers] = useState<Record<LeverId, number>>({
    recycledMaterialPercent: 0,
    energyEfficiencyPercent: 0,
    fuelReplacementPercent: 0,
    wasteRecoveryPercent: 0,
  })
  const [scenarioName, setScenarioName] = useState("")
  const [savedName, setSavedName] = useState<string | null>(null)

  const { result, isLoading, error, calculate } = useScenario(factory?.id)
  const saved = useSavedScenarios(factory?.id)

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

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    const name = scenarioName.trim()
    if (!name || !result) return
    if (await saved.save({ ...levers, name })) {
      setScenarioName("")
      setSavedName(name)
    }
  }

  const changeFactory = (id: number) => {
    setSavedName(null)
    selectFactory(id)
  }

  const chartData = useMemo(() => {
    if (!result) return []
    return [
      {
        name: "Emissions",
        Baseline: result.baselineEmission,
        Projected: result.projectedEmission,
      },
    ]
  }, [result])

  if (status !== "ready" || !factory) {
    return (
      <>
        <PageHeader
          title="What-if Simulator"
          description="Adjust intervention assumptions and compare projected emissions against your baseline. Baseline data is never modified."
        />
        {status === "loading" ? (
          <LoadingState label="Loading factories…" />
        ) : status === "error" ? (
          <ErrorState message={factoriesError ?? undefined} onRetry={reload} />
        ) : (
          <Card>
            <EmptyState
              icon={FactoryIcon}
              title="Set up a factory first"
              description="Scenarios project interventions against a factory's recorded baseline emissions."
              action={
                <Link to="/factory" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Open Factory Setup
                </Link>
              }
            />
          </Card>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="What-if Simulator"
        description="Adjust intervention assumptions and compare projected emissions against your baseline. Baseline data is never modified."
        actions={factory && <FactorySelect factories={factories} value={factory.id} onChange={changeFactory} />}
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
            <Button onClick={handleCalculate} disabled={isLoading || !factory} className="w-fit">
              <Calculator />
              {isLoading ? "Calculating..." : "Calculate scenario"}
            </Button>
            {error && <div className="mt-2 text-sm text-destructive">{error}</div>}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardCard label="Current" value={result ? formatNumber(result.baselineEmission) : "—"} unit={result?.unit || "tCO2e"} />
            <DashboardCard label="Projected" value={result ? formatNumber(result.projectedEmission) : "—"} unit={result?.unit || "tCO2e"} />
            <DashboardCard label="Reduction" value={result ? formatNumber(result.reductionAmount) : "—"} unit={result?.unit || "tCO2e"} />
            <DashboardCard label="Reduction %" value={result ? formatPercent(result.reductionPercent) : "—"} />
          </div>

          <Card className="flex min-h-[350px] flex-1 flex-col">
            {!result ? (
              <EmptyState
                icon={SlidersHorizontal}
                title="No scenario calculated"
                description="Run a scenario to compare baseline and projected emissions, cost, savings and payback."
              />
            ) : (
              <CardContent className="flex flex-1 flex-col gap-6 pt-6">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${formatNumber(Number(value))} ${result.unit}`, ""]} />
                      <Legend />
                      <Bar dataKey="Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Projected" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Est. cost</p>
                    <p className="font-semibold">${formatNumber(result.estimatedCost)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Est. savings</p>
                    <p className="font-semibold">${formatNumber(result.estimatedSavings)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Projected payback</p>
                    <p className="font-semibold">{formatYears(result.paybackPeriod)}</p>
                  </div>
                </div>

                {result.assumptions.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium">Assumptions</p>
                    <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                      {result.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Saved scenarios</CardTitle>
            <CardDescription className="mt-0.5">
              Saved scenarios are stored separately from baseline data. The newest one is used as the projected impact in the AI
              action plan.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!canSave && user ? (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Your role ({ROLE_LABELS[user.role]}) can review saved scenarios. Admins, factory operators and consultants can save them.
              </span>
            </div>
          ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={scenarioName}
              onChange={(event) => {
                setScenarioName(event.target.value)
                setSavedName(null)
              }}
              placeholder="Scenario name, e.g. 30% recycled material"
              maxLength={100}
              disabled={!factory || !result}
              aria-label="Scenario name"
              className="sm:max-w-sm"
            />
            <Button type="submit" disabled={!factory || !result || !scenarioName.trim() || saved.saving || isLoading}>
              <Bookmark />
              {saved.saving ? "Saving…" : "Save current scenario"}
            </Button>
          </form>
          )}
          {saved.saveError && <p className="text-sm text-destructive">{saved.saveError}</p>}
          {savedName && !saved.saveError && <p className="text-sm text-muted-foreground">Saved “{savedName}”.</p>}

          {saved.error ? (
            <ErrorState title="Saved scenarios are unavailable" message={saved.error} onRetry={saved.reload} />
          ) : !saved.items ? (
            factory ? <LoadingState label="Loading saved scenarios…" /> : null
          ) : saved.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved scenarios yet. Calculate one above and give it a name to save it.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Saved</th>
                    <th className="px-3 py-2 text-right font-medium">Baseline</th>
                    <th className="px-3 py-2 text-right font-medium">Projected</th>
                    <th className="px-3 py-2 text-right font-medium">Reduction</th>
                    <th className="px-3 py-2 text-right font-medium">Est. cost</th>
                    <th className="px-3 py-2 text-right font-medium">Est. savings</th>
                    <th className="px-3 py-2 text-right font-medium">Payback</th>
                  </tr>
                </thead>
                <tbody>
                  {saved.items.map((scenario) => (
                    <tr key={scenario.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{scenario.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(scenario.createdAt)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatNumber(scenario.baselineEmission)} {scenario.unit}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatNumber(scenario.projectedEmission)} {scenario.unit}
                      </td>
                      <td className="px-3 py-2 text-right">{formatPercent(scenario.reductionPercent)}</td>
                      <td className="px-3 py-2 text-right">${formatNumber(scenario.estimatedCost)}</td>
                      <td className="px-3 py-2 text-right">${formatNumber(scenario.estimatedSavings)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatYears(scenario.paybackPeriod)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
