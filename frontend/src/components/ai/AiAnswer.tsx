import ActionPlanView from "@/components/ai/ActionPlanView"
import ConfidenceBadge from "@/components/ai/ConfidenceBadge"
import Markdown from "@/components/ai/Markdown"
import { Badge } from "@/components/ui/badge"
import type { CopilotResponse } from "@/services/aiService"
import { formatNumber, formatPercent } from "@/utils/format"

const TOOL_LABELS: Record<string, string> = {
  get_factory_profile: "Factory profile",
  get_emissions_summary: "Emission totals",
  get_hotspot_ranking: "Hotspot ranking",
  get_hotspot_detail: "Process detail",
  find_circular_alternatives: "Circular alternatives",
  calculate_impact: "Impact estimate",
  rank_interventions: "Intervention ranking",
  get_recommendations: "Recommendations",
  list_scenarios: "Saved scenarios",
  parse_intervention_parameters: "Scenario parameters",
  calculate_scenario: "Scenario engine",
  generate_action_plan: "Action plan",
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

const show = (value: number | null, unit = "") => (value == null ? "—" : `${formatNumber(value)}${unit ? ` ${unit}` : ""}`)

/** A copilot answer: explanation, structured results, confidence, tools used and assumptions. */
export default function AiAnswer({ response }: { response: CopilotResponse }) {
  const plan = response.actionPlan
  const { scenario } = response

  return (
    <div className="flex flex-col gap-4">
      {plan ? <ActionPlanView plan={plan} /> : <Markdown text={response.answer} />}

      {response.recommendations.length > 0 && (
        <ol className="flex flex-col gap-2">
          {response.recommendations.map((item) => (
            <li key={`${item.rank}-${item.name}`} className="rounded-lg border bg-background px-3 py-2 text-sm">
              <p className="font-medium">
                #{item.rank} {item.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  item.score != null && `score ${formatNumber(item.score)}`,
                  item.reductionPercent != null && `estimated reduction ${formatPercent(item.reductionPercent)}`,
                  item.costLevel && `cost ${item.costLevel.toLowerCase()}`,
                  `projected payback ${item.paybackYears == null ? "N/A" : `${formatNumber(item.paybackYears, 1)} years`}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      )}

      {scenario && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Baseline" value={show(scenario.baselineEmission, scenario.unit ?? "")} />
          <Stat label="Projected" value={show(scenario.projectedEmission, scenario.unit ?? "")} />
          <Stat label="Reduction" value={scenario.reductionPercent == null ? "—" : formatPercent(scenario.reductionPercent)} />
          <Stat label="Est. cost" value={scenario.estimatedCost == null ? "—" : `$${formatNumber(scenario.estimatedCost)}`} />
          <Stat label="Est. savings" value={scenario.estimatedSavings == null ? "—" : `$${formatNumber(scenario.estimatedSavings)}`} />
          <Stat label="Projected payback" value={!scenario.paybackPeriod || scenario.paybackPeriod === "N/A" ? "N/A" : `${scenario.paybackPeriod} years`} />
        </div>
      )}

      <div className="flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1.5">
          {!plan && <ConfidenceBadge level={response.confidence} />}
          {response.toolsUsed.map((tool) => (
            <Badge key={tool.name} variant="muted">
              {TOOL_LABELS[tool.name] ?? tool.name}
            </Badge>
          ))}
        </div>
        {!plan && response.assumptions.length > 0 && (
          <details>
            <summary className="cursor-pointer select-none">Assumptions and limitations ({response.assumptions.length})</summary>
            <ul className="mt-1 list-disc pl-5">
              {response.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}
