import { useMemo } from "react"
import { useLatestRequest } from "@/hooks/useLatestRequest"
import { emissionService, type EmissionSummaryQuery } from "@/services/emissionService"

/** Loads the dashboard summary for a factory and refetches when the filters change. */
export function useEmissionSummary(factoryId: number | null, { from, to, source, granularity }: EmissionSummaryQuery) {
  const fetcher = useMemo(
    () => (factoryId == null ? null : () => emissionService.getSummary(factoryId, { from, to, source, granularity })),
    [factoryId, from, to, source, granularity]
  )
  const { data, ...state } = useLatestRequest(fetcher, "Emission data could not be loaded.")
  return { summary: data, ...state }
}
