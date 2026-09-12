import { ClipboardList } from "lucide-react"
import AiAnswer from "@/components/ai/AiAnswer"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCopilotRequest } from "@/hooks/useCopilotRequest"
import { ACTION_PLAN_PROMPT } from "@/services/aiService"

/** Generates the structured sustainability action plan for the selected factory. */
export default function ActionPlanCard({ factoryId }: { factoryId: number | null }) {
  const plan = useCopilotRequest(factoryId)
  const generate = () => void plan.ask(ACTION_PLAN_PROMPT)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" aria-hidden />
              Sustainability action plan
            </CardTitle>
            <CardDescription className="mt-0.5">
              Combines hotspots, root-cause findings, these ranked recommendations and your newest saved what-if scenario. Estimates
              only — your team makes the final decision.
            </CardDescription>
          </div>
          <Button size="sm" onClick={generate} disabled={!factoryId || plan.loading}>
            <ClipboardList />
            {plan.loading ? "Generating…" : plan.response ? "Regenerate plan" : "Generate action plan"}
          </Button>
        </div>
      </CardHeader>
      {(plan.loading || plan.error || plan.response) && (
        <CardContent>
          {plan.loading ? (
            <LoadingState label="Building the plan from hotspots, recommendations and scenarios…" />
          ) : plan.error ? (
            <ErrorState title="The action plan could not be generated" message={plan.error} onRetry={generate} />
          ) : (
            plan.response && <AiAnswer response={plan.response} />
          )}
        </CardContent>
      )}
    </Card>
  )
}
