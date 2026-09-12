import { apiClient, type ApiSuccess } from "@/services/apiClient"
import type { EmissionSummary } from "@/services/emissionService"
import type { Hotspot } from "@/services/hotspotService"
import type { Recommendation } from "@/services/recommendationService"
import type { SavedScenario } from "@/services/scenarioService"

export type ReportFactory = {
  id: number
  name: string
  location: string | null
  industry: string | null
  productionCapacity?: number | null
  productionUnit: string | null
}

/** Calculated historical emissions. Every value is aggregated by the backend carbon engine. */
export type ReportEmissions = {
  total: number
  unit: string
  /** Part of `total` that comes from simulated readings (BR-12). */
  simulatedCo2e?: number
  bySource: EmissionSummary["bySource"]
  byProcess: EmissionSummary["byProcess"]
  intensity: EmissionSummary["intensity"]
}

/** Carbon assessment report: calculated history, estimated recommendations and projected scenarios. */
export type FactoryReport = {
  factory: ReportFactory
  generatedAt?: string
  emissions: ReportEmissions
  hotspots: Hotspot[]
  recommendations: Recommendation[]
  scenarios: SavedScenario[]
  methodology: string[]
  assumptions: string[]
}

export const reportService = {
  async getReport(factoryId: number): Promise<FactoryReport> {
    const res = await apiClient.get<ApiSuccess<FactoryReport>>(`/factories/${factoryId}/report`)
    return res.data.data
  },
}
