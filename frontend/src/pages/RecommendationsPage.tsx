import { Link } from "react-router"
import { Factory as FactoryIcon, Lock, Recycle, RefreshCw, TriangleAlert } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FactorySelect from "@/components/FactorySelect"
import RecommendationCard, { type ScorePart } from "@/components/RecommendationCard"
import ActionPlanCard from "@/components/ai/ActionPlanCard"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useRecommendations } from "@/hooks/useRecommendations"
import type { Recommendation, ScoreComponents } from "@/services/recommendationService"
import { cn } from "@/lib/utils"
import { ANALYSIS_RUNNERS, ROLE_LABELS } from "@/utils/roles"
import { formatNumber, formatPercent } from "@/utils/format"

const COMPONENT_LABELS: Record<keyof ScoreComponents, string> = {
  environmentalImpact: "Environmental impact",
  financialBenefit: "Financial benefit",
  feasibility: "Feasibility",
  circularity: "Circularity",
}
const COMPONENT_ORDER = Object.keys(COMPONENT_LABELS) as (keyof ScoreComponents)[]

const describeWeights = (weights: ScoreComponents) =>
  COMPONENT_ORDER.map((key) => `${formatPercent(weights[key] * 100, 0)} ${COMPONENT_LABELS[key].toLowerCase()}`).join(", ")

const breakdownFor = (recommendation: Recommendation, weights: ScoreComponents): ScorePart[] =>
  COMPONENT_ORDER.map((key) => ({ label: COMPONENT_LABELS[key], value: recommendation.scoreBreakdown[key], weight: weights[key] }))

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

export default function RecommendationsPage() {
  const { user } = useAuth()
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  const factoryId = factory?.id ?? null
  const { list, loading, error: listError, reload: reloadList, generate, generating, generateError, lastRun } =
    useRecommendations(factoryId)
  // Never show recommendations loaded for a previously selected factory.
  const current = list && list.factory.id === factoryId ? list : null
  const hasRecommendations = !!current && current.recommendations.length > 0
  const canGenerate = !!user && ANALYSIS_RUNNERS.includes(user.role)

  const generateButton =
    canGenerate && factory ? (
      <Button size="sm" onClick={generate} disabled={generating}>
        <RefreshCw className={cn(generating && "animate-spin")} />
        {generating ? "Scoring…" : hasRecommendations ? "Regenerate" : "Generate recommendations"}
      </Button>
    ) : null

  const notices = (
    <>
      {generateError && (
        <Alert variant="destructive" className="mb-4">
          <TriangleAlert />
          <AlertTitle>Recommendations could not be generated</AlertTitle>
          <AlertDescription>{generateError}</AlertDescription>
        </Alert>
      )}
      {lastRun?.warnings.map((warning) => (
        <Alert key={warning.code} className="mb-4">
          <TriangleAlert />
          <AlertDescription>{warning.message}</AlertDescription>
        </Alert>
      ))}
      {!canGenerate && user && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Your role ({ROLE_LABELS[user.role]}) can review recommendations. Admins, factory operators and consultants can generate them.
          </span>
        </div>
      )}
    </>
  )

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
          description="Recommendations are matched to the emissions a factory records."
          action={
            <Link to="/factory" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Factory Setup
            </Link>
          }
        />
      </Card>
    )
  } else if (!current) {
    content = listError ? (
      <Card>
        <ErrorState title="Recommendations are unavailable" message={listError} onRetry={reloadList} />
      </Card>
    ) : (
      <LoadingState label="Loading recommendations…" />
    )
  } else if (!hasRecommendations) {
    content = (
      <>
        {notices}
        <Card>
          <EmptyState
            icon={Recycle}
            title="No recommendations yet"
            description={
              canGenerate
                ? "Generate recommendations to score circular alternatives against this factory's last 12 months of emissions."
                : "No recommendations have been generated for this factory yet."
            }
            action={generateButton}
          />
        </Card>
      </>
    )
  } else {
    const busy = loading || generating
    content = (
      <div aria-busy={busy} className={cn("transition-opacity", busy && "opacity-60")}>
        {notices}
        <p className="mb-4 text-sm text-muted-foreground">
          {current.recommendations.length} interventions ranked for {current.factory.name}
          {current.generatedAt && ` · generated ${formatDateTime(current.generatedAt)}`}
          {lastRun &&
            ` from emissions recorded ${lastRun.basis.from} to ${lastRun.basis.to} (${formatNumber(lastRun.basis.factoryEmission)} ${lastRun.basis.co2eUnit})`}
          .
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {current.recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              rank={recommendation.rank}
              title={recommendation.alternative}
              category={recommendation.category}
              target={recommendation.scope === "FACTORY" ? "Factory-wide" : (recommendation.process ?? "Process")}
              score={recommendation.score}
              reductionPercent={recommendation.reductionPercent}
              costLevel={recommendation.estimatedCost}
              paybackYears={recommendation.paybackPeriod}
              savings={{
                value: recommendation.estimatedSavings,
                unit: recommendation.savingsUnit,
                shareOfFactory: recommendation.estimatedReduction,
              }}
              reason={recommendation.reason}
              status={recommendation.status}
              breakdown={breakdownFor(recommendation, current.weights)}
              assumptions={recommendation.assumptions}
            />
          ))}
        </div>
        <div className="mt-6">
          <ActionPlanCard factoryId={factoryId} />
        </div>
        <Card className="mt-6">
          <CardHeader>
            <div>
              <CardTitle>How recommendations are calculated</CardTitle>
              <CardDescription className="mt-0.5">Scores are deterministic. An AI explanation may describe a score but never produces one.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 text-sm text-muted-foreground">
              {current.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
            {lastRun && lastRun.unmatchedAlternatives.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Not recommended because no recorded activity matches them yet:{" "}
                {lastRun.unmatchedAlternatives.map((alternative) => alternative.alternative).join(", ")}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Circular Recommendations"
        description={`Interventions ranked by a deterministic score${current ? `: ${describeWeights(current.weights)}` : ""}.`}
        actions={
          factory && (
            <>
              <FactorySelect factories={factories} value={factory.id} onChange={selectFactory} />
              {hasRecommendations && generateButton}
            </>
          )
        }
      />
      {content}
    </>
  )
}
