import { apiClient, type ApiSuccess } from "@/services/apiClient"
import type { CostLevel } from "@/types/domain"

export type RecommendationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "IMPLEMENTED"

/** BR-06 components on a common 0–100 scale (and, for weights, their share of the score). */
export type ScoreComponents = {
  environmentalImpact: number
  financialBenefit: number
  feasibility: number
  circularity: number
}

/** One ranked intervention. Every number is calculated by the backend scoring service. */
export type Recommendation = {
  id: number
  rank: number
  status: RecommendationStatus
  alternativeId: number
  alternative: string
  currentOption: string
  category: string
  description: string | null
  /** FACTORY: applies across the factory; PROCESS: applies to `process`. */
  scope: "FACTORY" | "PROCESS"
  processId: number | null
  process: string | null
  score: number
  scoreBreakdown: ScoreComponents
  /** Share of the factory's emissions the intervention is estimated to avoid (%). */
  estimatedReduction: number | null
  /** Knowledge-base reduction of the emissions the intervention targets (%). */
  reductionPercent: number | null
  /** Estimated CO2e avoided per year. */
  estimatedSavings: number | null
  savingsUnit: string
  estimatedCost: CostLevel | null
  implementationDifficulty: CostLevel | null
  paybackPeriod: number | null
  circularityScore: number | null
  reason: string | null
  assumptions: string[]
  createdAt: string
}

export type RecommendationList = {
  factory: { id: number; name: string }
  generatedAt: string | null
  weights: ScoreComponents
  assumptions: string[]
  recommendations: Recommendation[]
}

export type RecommendationRun = RecommendationList & {
  basis: { from: string; to: string; factoryEmission: number; co2eUnit: string }
  created: number
  keptDecided: number
  unmatchedAlternatives: { id: number; alternative: string; currentOption: string; category: string }[]
  warnings: { code: string; message: string }[]
}

export const recommendationService = {
  async list(factoryId: number): Promise<RecommendationList> {
    const res = await apiClient.get<ApiSuccess<RecommendationList>>(`/factories/${factoryId}/recommendations`)
    return res.data.data
  },

  async generate(factoryId: number): Promise<RecommendationRun> {
    const res = await apiClient.post<ApiSuccess<RecommendationRun>>(`/factories/${factoryId}/recommendations/generate`, {})
    return res.data.data
  },
}
