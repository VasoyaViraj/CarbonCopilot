import type { ReactNode } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon, Printer } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FactorySelect from "@/components/FactorySelect"
import SeverityBadge from "@/components/SeverityBadge"
import EmptyState from "@/components/feedback/EmptyState"
import LoadingState from "@/components/feedback/LoadingState"
import ErrorState from "@/components/feedback/ErrorState"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useReport } from "@/hooks/useReport"
import type { FactoryReport } from "@/services/reportService"
import { cn } from "@/lib/utils"
import { formatNumber, formatPercent, formatYears } from "@/utils/format"

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })

function Section({ title, description, className, children }: { title: string; description?: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("print:break-inside-avoid print:shadow-none", className)}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

function ReportContent({ report }: { report: FactoryReport }) {
  const { factory, emissions } = report
  const unit = emissions.unit
  const simulated = emissions.simulatedCo2e ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">
          {report.generatedAt ? `Generated ${formatDate(report.generatedAt)} from` : "Assembled from"} the factory's recorded data.
        </p>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" /> Print / Export PDF
        </Button>
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Carbon Assessment Report — {factory.name}</h1>
        {report.generatedAt && <p className="text-sm">Generated {formatDate(report.generatedAt)}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Factory summary">
          <Row label="Name">{factory.name}</Row>
          <Row label="Industry">{factory.industry || "Not recorded"}</Row>
          <Row label="Location">{factory.location || "Not recorded"}</Row>
          {factory.productionCapacity != null && (
            <Row label="Production capacity">
              {formatNumber(factory.productionCapacity)} {factory.productionUnit ?? ""}
            </Row>
          )}
        </Section>

        <Section title="Emission summary" description="Calculated historical values from recorded activities and emission factors.">
          <Row label="Total emissions">
            {formatNumber(emissions.total)} {unit}
          </Row>
          <Row label="Emission intensity">
            {emissions.intensity.value == null ? "Not available" : `${formatNumber(emissions.intensity.value, 4)} ${emissions.intensity.unit ?? ""}`}
          </Row>
          {simulated > 0 && (
            <Row label="From simulated readings">
              {formatNumber(simulated)} {unit}
            </Row>
          )}
          {emissions.bySource.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {emissions.bySource.map((source) => (
                <li key={source.activityType} className="flex justify-between gap-4 text-muted-foreground">
                  <span>{source.label}</span>
                  <span>
                    {formatNumber(source.co2e)} {unit} · {formatPercent(source.percentage)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Top hotspots" description="Processes ranked by their share of calculated emissions.">
          {report.hotspots.length === 0 ? (
            <p className="text-muted-foreground">No calculated emissions to rank yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {report.hotspots.slice(0, 5).map((hotspot) => (
                <li key={hotspot.processId} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                  <span>
                    <span className="font-semibold">#{hotspot.rank}</span> {hotspot.process}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {formatNumber(hotspot.emission)} {unit} · {formatPercent(hotspot.percentage)}
                    <SeverityBadge severity={hotspot.severity} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Recommendations" description="Estimated impact from the deterministic scoring service — not guaranteed outcomes.">
          {report.recommendations.length === 0 ? (
            <p className="text-muted-foreground">No recommendations have been generated yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {report.recommendations.slice(0, 5).map((recommendation) => (
                <li key={recommendation.id} className="border-b pb-2 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <strong>
                      #{recommendation.rank} {recommendation.alternative}
                    </strong>
                    <Badge variant="muted">{recommendation.status.toLowerCase()}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {recommendation.scope === "FACTORY" ? "Factory-wide" : recommendation.process} · score {formatNumber(recommendation.score)}
                  </p>
                  <p className="text-muted-foreground">
                    {recommendation.estimatedSavings != null &&
                      `Estimated ${formatNumber(recommendation.estimatedSavings)} ${recommendation.savingsUnit} avoided`}
                    {recommendation.estimatedReduction != null && ` (${formatPercent(recommendation.estimatedReduction, 2)} of factory emissions)`}
                    {` · projected payback ${formatYears(recommendation.paybackPeriod)}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section
          title="Projected reductions and financial impact"
          description="Projected values from saved what-if scenarios. Baseline data is never modified."
          className="md:col-span-2"
        >
          {report.scenarios.length === 0 ? (
            <p className="text-muted-foreground">No saved scenarios. Save one in the What-if Simulator to include it here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Scenario</th>
                    <th className="px-3 py-2 text-right font-medium">Baseline</th>
                    <th className="px-3 py-2 text-right font-medium">Projected</th>
                    <th className="px-3 py-2 text-right font-medium">Reduction</th>
                    <th className="px-3 py-2 text-right font-medium">Est. cost</th>
                    <th className="px-3 py-2 text-right font-medium">Est. savings</th>
                    <th className="py-2 pl-3 text-right font-medium">Payback</th>
                  </tr>
                </thead>
                <tbody>
                  {report.scenarios.map((scenario) => (
                    <tr key={scenario.id} className="border-t">
                      <td className="py-2 pr-3 font-medium">{scenario.name}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatNumber(scenario.baselineEmission)} {scenario.unit}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatNumber(scenario.projectedEmission)} {scenario.unit}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatNumber(scenario.reductionAmount)} {scenario.unit} ({formatPercent(scenario.reductionPercent)})
                      </td>
                      <td className="px-3 py-2 text-right">${formatNumber(scenario.estimatedCost)}</td>
                      <td className="px-3 py-2 text-right">${formatNumber(scenario.estimatedSavings)}</td>
                      <td className="py-2 pl-3 text-right whitespace-nowrap">{formatYears(scenario.paybackPeriod)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Methodology and assumptions" className="md:col-span-2">
          <div className="grid gap-4 text-muted-foreground md:grid-cols-2">
            <div>
              <h3 className="mb-1 font-semibold text-foreground">Methodology</h3>
              <ul className="list-disc space-y-1 pl-5">
                {report.methodology.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-foreground">Assumptions</h3>
              <ul className="list-disc space-y-1 pl-5">
                {report.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  const factoryId = factory?.id ?? null
  const { report, loading, error: reportError, reload: reloadReport } = useReport(factoryId)
  // Never show a report loaded for a previously selected factory.
  const current = report && report.factory.id === factoryId ? report : null

  let content
  if (status === "loading") {
    content = <LoadingState label="Loading factories…" />
  } else if (status === "error") {
    content = <ErrorState message={error ?? undefined} onRetry={reload} />
  } else if (!factory) {
    content = (
      <Card>
        <EmptyState
          icon={FactoryIcon}
          title="Set up a factory first"
          description="Reports are assembled from calculated emissions, hotspots, recommendations and scenarios."
          action={
            <Link to="/factory" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Factory Setup
            </Link>
          }
        />
      </Card>
    )
  } else if (!current) {
    content = reportError ? (
      <Card>
        <ErrorState title="The report is unavailable" message={reportError} onRetry={reloadReport} />
      </Card>
    ) : (
      <LoadingState label="Assembling report…" />
    )
  } else {
    content = (
      <div aria-busy={loading} className={cn("transition-opacity", loading && "opacity-60")}>
        <ReportContent report={current} />
      </div>
    )
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Carbon assessment report for sharing with management, consultants and auditors."
          actions={factory && <FactorySelect factories={factories} value={factory.id} onChange={selectFactory} />}
        />
      </div>
      {content}
    </>
  )
}
