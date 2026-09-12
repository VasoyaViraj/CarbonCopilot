import { apiClient, type ApiSuccess } from "./apiClient"

export type AnomalySignal = {
  currentIntensity: number
  baselineIntensity: number
  deviation: number
  threshold: number
  status: "NORMAL" | "ABNORMAL"
  explanation: string
  unit: string
}

export type AnomalyQuery = {
  threshold?: number
  baselineDays?: number
}

export const anomalyService = {
  async getAnomalySignal(factoryId: number, query?: AnomalyQuery): Promise<AnomalySignal> {
    const params = new URLSearchParams()
    if (query?.threshold !== undefined) params.append("threshold", String(query.threshold))
    if (query?.baselineDays !== undefined) params.append("baselineDays", String(query.baselineDays))
    
    const queryStr = params.toString()
    const url = `/factories/${factoryId}/anomaly${queryStr ? `?${queryStr}` : ""}`
    
    const res = await apiClient.get<ApiSuccess<AnomalySignal>>(url)
    return res.data.data
  },
}
