import { apiClient, type ApiSuccess } from "@/services/apiClient"
import type { ChatMessage } from "@/types/domain"

/** AI answers can take longer than ordinary API calls; Express enforces its own AI timeout. */
const AI_REQUEST_TIMEOUT_MS = 60_000

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE"

export type CopilotTool = { name: string; input: Record<string, unknown>; outputSummary: string | null }

/** A ranked intervention the recommendation workflow explained. Numbers come from deterministic tools. */
export type CopilotRecommendation = {
  rank: number
  name: string
  reductionPercent: number | null
  costLevel: string | null
  paybackYears: number | null
  score: number | null
  reason: string | null
}

/** Result of the deterministic scenario engine for a natural-language what-if question. */
export type CopilotScenario = {
  baselineEmission: number | null
  projectedEmission: number | null
  reductionAmount: number | null
  reductionPercent: number | null
  estimatedCost: number | null
  estimatedSavings: number | null
  paybackPeriod: string | null
  unit: string | null
}

export type PlanAction = { title: string; detail: string; relatedTo: string | null }

export type ImpactEstimate = {
  source: "recommendation" | "scenario" | string
  label: string
  estimatedCo2eReduction: number | null
  co2eReductionUnit: string | null
  estimatedReductionPercent: number | null
  estimatedCost: string | null
  estimatedSavings: string | null
  payback: string
  projection: string | null
  basis: string
}

export type SuccessMetric = { metric: string; baseline: string; target: string }

/** Structured sustainability action plan (Phase 19). Every figure is copied from tool results. */
export type ActionPlan = {
  immediateInvestigation: PlanAction[]
  shortTermActions: PlanAction[]
  mediumTermInterventions: PlanAction[]
  measurements: PlanAction[]
  expectedImpact: ImpactEstimate[]
  risksAndLimitations: string[]
  successMetrics: SuccessMetric[]
  decisionNote: string
  /** LLM: the action wording was refined by the AI and passed the grounding checks. */
  source: "DETERMINISTIC" | "LLM"
  confidence: ConfidenceLevel
}

export type CopilotResponse = {
  answer: string
  toolsUsed: CopilotTool[]
  recommendations: CopilotRecommendation[]
  scenario: CopilotScenario | null
  assumptions: string[]
  confidence: ConfidenceLevel
  intent: string | null
  actionPlan: ActionPlan | null
  conversationId: number | null
}

export type CopilotHistory = {
  conversationId: number | null
  messages: ChatMessage[]
}

export const ACTION_PLAN_PROMPT = "Generate an action plan."

export const aiService = {
  async askCopilot(factoryId: number, message: string, conversationId?: number | null): Promise<CopilotResponse> {
    const res = await apiClient.post<ApiSuccess<CopilotResponse>>(
      "/ai/copilot",
      { factoryId, message, ...(conversationId ? { conversationId } : {}) },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    )
    return res.data.data
  },

  async getHistory(factoryId: number): Promise<CopilotHistory> {
    const res = await apiClient.get<ApiSuccess<CopilotHistory>>(`/factories/${factoryId}/ai/history`)
    return res.data.data
  },
}
