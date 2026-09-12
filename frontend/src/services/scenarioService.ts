import { apiClient, type ApiSuccess } from "./apiClient"

export type ScenarioInput = {
  recycledMaterialPercent: number
  energyEfficiencyPercent: number
  fuelReplacementPercent: number
  wasteRecoveryPercent: number
}

export type ScenarioResult = {
  baselineEmission: number
  projectedEmission: number
  reductionAmount: number
  reductionPercent: number
  estimatedCost: number
  estimatedSavings: number
  paybackPeriod: number | null
  unit: string
  assumptions: string[]
}

export type SavedScenario = ScenarioResult & {
  id: number
  factoryId: number
  name: string
  description: string | null
  createdAt: string
}

export const scenarioService = {
  async calculate(factoryId: number, input: ScenarioInput): Promise<ScenarioResult> {
    const res = await apiClient.post<ApiSuccess<ScenarioResult>>(`/factories/${factoryId}/scenarios/calculate`, input)
    return res.data.data
  },

  async save(factoryId: number, input: ScenarioInput & { name: string; description?: string | null }): Promise<SavedScenario> {
    const res = await apiClient.post<ApiSuccess<SavedScenario>>(`/factories/${factoryId}/scenarios`, input)
    return res.data.data
  },

  async list(factoryId: number): Promise<SavedScenario[]> {
    const res = await apiClient.get<ApiSuccess<SavedScenario[]>>(`/factories/${factoryId}/scenarios`)
    return res.data.data
  },
}
