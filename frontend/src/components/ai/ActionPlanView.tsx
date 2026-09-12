import type { ReactNode } from "react"
import { Hammer, Ruler, Search, ShieldAlert, Target, TrendingDown, Zap, type LucideIcon } from "lucide-react"
import ConfidenceBadge from "@/components/ai/ConfidenceBadge"
import { Badge } from "@/components/ui/badge"
import type { ActionPlan, ImpactEstimate, PlanAction } from "@/services/aiService"
import { formatNumber, formatPercent } from "@/utils/format"

type ActionSectionKey = "immediateInvestigation" | "shortTermActions" | "mediumTermInterventions" | "measurements"

const ACTION_SECTIONS: { key: ActionSectionKey; title: string; icon: LucideIcon }[] = [
  { key: "immediateInvestigation", title: "1. Immediate investigation", icon: Search },
  { key: "shortTermActions", title: "2. Short-term action", icon: Zap },
  { key: "mediumTermInterventions", title: "3. Medium-term intervention", icon: Hammer },
  { key: "measurements", title: "4. Measurement to perform", icon: Ruler },
]

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </h4>
      {children}
    </section>
  )
}

function Actions({ actions }: { actions: PlanAction[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {actions.map((action, index) => (
        <li key={`${action.title}-${index}`} className="rounded-lg border bg-background p-3">
          <p className="text-sm font-medium">{action.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
        </li>
      ))}
    </ul>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </>
  )
}

function Impact({ impact }: { impact: ImpactEstimate }) {
  return (
    <div className="flex flex-col rounded-lg border bg-background p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{impact.label}</p>
        <Badge variant="muted">{impact.source === "scenario" ? "Saved scenario" : "Recommendation"}</Badge>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {impact.estimatedCo2eReduction != null && (
          <Fact label="Est. reduction">
            {formatNumber(impact.estimatedCo2eReduction)} {impact.co2eReductionUnit}
          </Fact>
        )}
        {impact.estimatedReductionPercent != null && (
          <Fact label="Share of factory">{formatPercent(impact.estimatedReductionPercent, 2)}</Fact>
        )}
        {impact.estimatedCost && <Fact label="Est. cost">{impact.estimatedCost}</Fact>}
        {impact.estimatedSavings && <Fact label="Est. savings">{impact.estimatedSavings}</Fact>}
        <Fact label="Projected payback">{impact.payback}</Fact>
      </dl>
      {impact.projection && <p className="mt-2 text-xs text-muted-foreground">{impact.projection}</p>}
      <p className="mt-2 text-xs text-muted-foreground italic">{impact.basis}</p>
    </div>
  )
}

/** The seven-section action plan. Figures are shown as returned by the deterministic tools. */
export default function ActionPlanView({ plan }: { plan: ActionPlan }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge level={plan.confidence} />
        <Badge variant="muted">{plan.source === "LLM" ? "Wording refined by AI · figures from tools" : "Rule-based plan · figures from tools"}</Badge>
      </div>
      <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{plan.decisionNote}</p>

      {ACTION_SECTIONS.map(({ key, title, icon }) => (
        <Section key={key} title={title} icon={icon}>
          <Actions actions={plan[key]} />
        </Section>
      ))}

      <Section title="5. Expected impact" icon={TrendingDown}>
        {plan.expectedImpact.length === 0 ? (
          <p className="text-sm text-muted-foreground">No estimate is available from the current data.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.expectedImpact.map((impact, index) => (
              <Impact key={`${impact.label}-${index}`} impact={impact} />
            ))}
          </div>
        )}
      </Section>

      <Section title="6. Risks / limitations" icon={ShieldAlert}>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {plan.risksAndLimitations.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </Section>

      <Section title="7. Success metric" icon={Target}>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Metric</th>
                <th className="px-3 py-2 font-medium">Baseline</th>
                <th className="px-3 py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {plan.successMetrics.map((metric) => (
                <tr key={metric.metric} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">{metric.metric}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{metric.baseline}</td>
                  <td className="px-3 py-2 text-muted-foreground">{metric.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
