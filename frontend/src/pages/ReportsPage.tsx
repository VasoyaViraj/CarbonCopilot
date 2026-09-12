import { useState, useEffect } from "react"
import { Link } from "react-router"
import { FileText, Printer, Factory as FactoryIcon } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FactorySelect from "@/components/FactorySelect"
import EmptyState from "@/components/feedback/EmptyState"
import LoadingState from "@/components/feedback/LoadingState"
import ErrorState from "@/components/feedback/ErrorState"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { reportService, type FactoryReport } from "@/services/reportService"
import { getApiErrorMessage } from "@/services/apiClient"

export default function ReportsPage() {
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  const [report, setReport] = useState<FactoryReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    if (!factory) return
    let mounted = true
    setReportLoading(true)
    setReportError(null)

    reportService.getReport(factory.id)
      .then((data) => {
        if (mounted) setReport(data)
      })
      .catch((err) => {
        if (mounted) setReportError(getApiErrorMessage(err, "Failed to load report."))
      })
      .finally(() => {
        if (mounted) setReportLoading(false)
      })

    return () => { mounted = false }
  }, [factory])

  let content
  if (status === "loading" || reportLoading) {
    content = <LoadingState label="Loading report..." />
  } else if (status === "error") {
    content = <ErrorState message={error ?? undefined} onRetry={reload} />
  } else if (reportError) {
    content = <ErrorState message={reportError} />
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
  } else if (report) {
    content = (
      <div className="space-y-8 print:space-y-6">
        <div className="flex justify-end print:hidden">
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print / Export PDF
          </Button>
        </div>

        <div className="print:block" id="report-content">
          <h1 className="text-3xl font-bold mb-6 hidden print:block">Carbon Assessment Report</h1>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Factory Summary */}
            <Card className="print:shadow-none print:border-gray-200">
              <CardHeader>
                <CardTitle>Factory Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Name:</strong> {report.factory.name}</p>
                <p><strong>Location:</strong> {report.factory.location}</p>
                <p><strong>Industry:</strong> {report.factory.industry}</p>
              </CardContent>
            </Card>

            {/* Emission Summary */}
            <Card className="print:shadow-none print:border-gray-200">
              <CardHeader>
                <CardTitle>Calculated Historical Emissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Total:</strong> {report.emissions.total} {report.emissions.unit}</p>
                <p><strong>Intensity:</strong> {report.emissions.intensity.value ?? "N/A"} {report.emissions.intensity.unit ?? ""}</p>
                <div>
                  <strong>By Source:</strong>
                  <ul className="list-disc pl-5 mt-1 text-sm">
                    {report.emissions.bySource.map(s => (
                      <li key={s.activityType}>{s.activityType}: {s.co2e} {report.emissions.unit} ({s.percentage}%)</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Hotspots */}
            <Card className="print:shadow-none print:border-gray-200">
              <CardHeader>
                <CardTitle>Top Hotspots</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.hotspots.slice(0, 3).map((h, i) => (
                    <li key={h.process} className="flex justify-between border-b pb-2 last:border-0">
                      <span><span className="font-semibold">{i + 1}.</span> {h.process}</span>
                      <span className="text-muted-foreground">{h.percentage}% (Severity: {h.severity})</span>
                    </li>
                  ))}
                  {report.hotspots.length === 0 && <p className="text-muted-foreground">No hotspots found.</p>}
                </ul>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="print:shadow-none print:border-gray-200">
              <CardHeader>
                <CardTitle>Estimated Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="flex flex-col border-b pb-2 last:border-0 text-sm">
                      <strong className="text-base">{i + 1}. {r.name}</strong>
                      <span>Expected Reduction: {r.reductionPercent ?? 0}%</span>
                      <span>Payback Period: {r.paybackYears ? `${r.paybackYears} years` : 'N/A'}</span>
                    </li>
                  ))}
                  {report.recommendations.length === 0 && <p className="text-muted-foreground">No recommendations available.</p>}
                </ul>
              </CardContent>
            </Card>

            {/* Scenarios */}
            <Card className="print:shadow-none print:border-gray-200 md:col-span-2">
              <CardHeader>
                <CardTitle>Projected Scenario Values & Financial Impact</CardTitle>
              </CardHeader>
              <CardContent>
                {report.scenarios.length === 0 ? (
                  <p className="text-muted-foreground">No saved scenarios.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {report.scenarios.map(s => (
                      <div key={s.id} className="border p-4 rounded-md">
                        <strong className="block mb-1 text-lg">{s.name}</strong>
                        <div className="text-sm space-y-1">
                          <p><strong>Baseline:</strong> {s.baselineEmission} {s.unit}</p>
                          <p><strong>Projected:</strong> {s.projectedEmission} {s.unit}</p>
                          <p><strong>Reduction:</strong> {s.reductionAmount} {s.unit} ({s.reductionPercent}%)</p>
                          <p><strong>Est. Cost:</strong> ${s.estimatedCost}</p>
                          <p><strong>Est. Savings:</strong> ${s.estimatedSavings}/yr</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Methodology & Assumptions */}
            <Card className="print:shadow-none print:border-gray-200 md:col-span-2">
              <CardHeader>
                <CardTitle>Methodology & Assumptions</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Methodology</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {report.methodology.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Assumptions</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {report.assumptions.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
