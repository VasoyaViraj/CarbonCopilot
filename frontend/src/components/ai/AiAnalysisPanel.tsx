import { Sparkles, X } from "lucide-react"
import AiAnswer from "@/components/ai/AiAnswer"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CopilotResponse } from "@/services/aiService"

type AiAnalysisPanelProps = {
  title: string
  description?: string
  loading: boolean
  error: string | null
  response: CopilotResponse | null
  loadingLabel?: string
  onRetry?: () => void
  onClose?: () => void
}

/** Shows one AI answer grounded in the factory's deterministic data. */
export default function AiAnalysisPanel({
  title,
  description = "AI explanation of the deterministic results. It never recalculates them.",
  loading,
  error,
  response,
  loadingLabel = "Analyzing factory data…",
  onRetry,
  onClose,
}: AiAnalysisPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden />
              {title}
            </CardTitle>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close AI analysis">
              <X />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState label={loadingLabel} />
        ) : error ? (
          <ErrorState title="The AI analysis is unavailable" message={error} onRetry={onRetry} />
        ) : response ? (
          <AiAnswer response={response} />
        ) : null}
      </CardContent>
    </Card>
  )
}
