import { FileText } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import EmptyState from "@/components/feedback/EmptyState"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SECTIONS = [
  "Factory summary",
  "Emission summary",
  "Top hotspots",
  "Root causes",
  "Recommendations",
  "Projected reductions",
  "Financial impact",
  "Methodology & assumptions",
]

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Carbon assessment report for sharing with management, consultants and auditors." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <EmptyState icon={FileText} title="No report generated" description="Reports are assembled from calculated emissions, hotspots, recommendations and scenarios." />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Report sections</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {SECTIONS.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
