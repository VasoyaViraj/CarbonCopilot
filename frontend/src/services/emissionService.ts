import { apiClient, type ApiSuccess } from "@/services/apiClient"
import type { ActivityCategory, ActivitySource } from "@/services/activityService"

export type HistoryGranularity = "day" | "month"

export type EmissionWarningCode = "MISSING_EMISSIONS" | "UNSUPPORTED_CO2E_UNIT" | "NO_PRODUCTION" | "MIXED_PRODUCTION_UNITS"

/**
 * Carbon dashboard figures aggregated by the backend from stored, deterministic emissions.
 * The UI displays these values as-is and never totals emissions itself.
 */
export type EmissionSummary = {
  factory: { id: number; name: string }
  filters: { from: string | null; to: string | null; source: ActivitySource | null; granularity: HistoryGranularity }
  /** Unit of every CO2e figure in the summary (tCO2e). */
  co2eUnit: string
  totals: { co2e: number; simulatedCo2e: number; activityCount: number; emissionCount: number }
  /** `quantity: null` when production is recorded in incompatible units. */
  production: { quantity: number | null; unit: string | null; byUnit: { unit: string; quantity: number }[] }
  /** `value: null` when intensity cannot be determined (no or incompatible production). */
  intensity: { value: number | null; unit: string | null }
  byProcess: { processId: number; process: string; co2e: number; percentage: number; activityCount: number }[]
  bySource: { activityType: string; label: string; category: ActivityCategory | null; co2e: number; percentage: number }[]
  byDataSource: { source: ActivitySource; isSimulated: boolean; co2e: number; activityCount: number; percentage: number }[]
  /** One point per period (YYYY-MM or YYYY-MM-DD, UTC); gaps are filled with 0. */
  history: { period: string; co2e: number }[]
  energy: {
    activityType: string
    label: string
    category: ActivityCategory
    unit: string
    total: number
    history: { period: string; quantity: number }[]
  }[]
  warnings: { code: EmissionWarningCode; message: string }[]
}

export type EmissionSummaryQuery = {
  from?: string
  to?: string
  source?: ActivitySource
  granularity?: HistoryGranularity
}

export const emissionService = {
  async getSummary(factoryId: number, query: EmissionSummaryQuery = {}): Promise<EmissionSummary> {
    const res = await apiClient.get<ApiSuccess<EmissionSummary>>(`/factories/${factoryId}/emissions/summary`, { params: query })
    return res.data.data
  },
}
