import { CircleAlert, RefreshCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EmissionSummary } from "@/services/emissionService"

type DashboardNoticesProps = {
  /** Data-quality warnings reported by the API alongside the summary. */
  warnings: EmissionSummary["warnings"]
  /** Set when a refetch failed while an earlier summary is still on screen. */
  refreshError?: string | null
  onRetry?: () => void
}

/** Explains why figures may be incomplete or stale, instead of silently showing partial data. */
export default function DashboardNotices({ warnings, refreshError, onRetry }: DashboardNoticesProps) {
  if (warnings.length === 0 && !refreshError) return null
  return (
    <div className="mb-6 flex flex-col gap-2">
      {refreshError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
          <span className="flex-1">The dashboard could not be refreshed, so the last loaded figures are shown. {refreshError}</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw /> Retry
            </Button>
          )}
        </div>
      )}
      {warnings.map((warning) => (
        <div key={warning.code} className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  )
}
