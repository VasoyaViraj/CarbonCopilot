import { apiClient, type ApiSuccess } from "@/services/apiClient"
import type { ActivitySource } from "@/services/activityService"
import type { EmissionSummary } from "@/services/emissionService"
import type { Severity } from "@/types/domain"

/** Severity cut-offs in % of total emissions, as configured on the backend. */
export type HotspotThresholds = { critical: number; high: number; medium: number }

/** One ranked process. Every value is calculated by the backend hotspot engine. */
export type Hotspot = {
  rank: number
  processId: number
  process: string
  emission: number
  percentage: number
  severity: Severity
  activityCount: number
}

type HotspotFilters = { from: string | null; to: string | null; source: ActivitySource | null }

export type HotspotRanking = {
  factory: { id: number; name: string }
  filters: HotspotFilters
  co2eUnit: string
  totalEmission: number
  activityCount: number
  emissionCount: number
  thresholds: HotspotThresholds
  /** Empty when the factory has no emissions to rank. */
  hotspots: Hotspot[]
  warnings: EmissionSummary["warnings"]
}

export type HotspotDetail = {
  factory: { id: number; name: string }
  filters: HotspotFilters
  co2eUnit: string
  process: { id: number; name: string; processType: string | null; description: string | null }
  /** null when the factory has no emissions to rank in the period. */
  hotspot: Hotspot | null
  factoryTotalEmission: number
  rankedProcessCount: number
  thresholds: HotspotThresholds
  emission: number
  simulatedEmission: number
  activityCount: number
  /** Emissions per source; `percentage` is the share of this process's emissions. */
  drivers: EmissionSummary["bySource"]
  history: EmissionSummary["history"]
  production: EmissionSummary["production"]
  intensity: EmissionSummary["intensity"]
  warnings: EmissionSummary["warnings"]
}

export type HotspotQuery = { from?: string; to?: string; source?: ActivitySource }

export const hotspotService = {
  async getRanking(factoryId: number, { from, to, source }: HotspotQuery = {}): Promise<HotspotRanking> {
    const res = await apiClient.get<ApiSuccess<HotspotRanking>>(`/factories/${factoryId}/hotspots`, { params: { from, to, source } })
    return res.data.data
  },

  async getDetail(factoryId: number, processId: number, { from, to, source }: HotspotQuery = {}): Promise<HotspotDetail> {
    const res = await apiClient.get<ApiSuccess<HotspotDetail>>(`/factories/${factoryId}/hotspots/${processId}`, {
      params: { from, to, source },
    })
    return res.data.data
  },
}
