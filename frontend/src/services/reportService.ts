import { apiClient, type ApiSuccess } from "@/services/apiClient"
import type { CopilotRecommendation, CopilotScenario } from "./aiService"

export type ReportFactory = {
  id: number
  name: string
  location: string
  industry: string
  size: string
  productionUnit: string
}

export type ReportEmissionEntry = {
  activityType?: string
  process?: string
  co2e: number
  percentage: number
}

export type ReportEmissions = {
  total: number
  unit: string
  bySource: ReportEmissionEntry[]
  byProcess: ReportEmissionEntry[]
  intensity: { value: number | null; unit: string | null }
}

export type ReportHotspot = {
  rank: number
  process: string
  percentage: number
  severity: string
}

export type FactoryReport = {
  factory: ReportFactory
  emissions: ReportEmissions
  hotspots: ReportHotspot[]
  recommendations: CopilotRecommendation[]
  scenarios: (CopilotScenario & { id: number; name: string })[]
  methodology: string[]
  assumptions: string[]
}

export const reportService = {
  async getReport(factoryId: number): Promise<FactoryReport> {
    const res = await apiClient.get<ApiSuccess<FactoryReport>>(`/factories/${factoryId}/report`)
    return res.data.data
  },
}
