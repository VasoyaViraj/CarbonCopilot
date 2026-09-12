import { useMemo } from "react"
import { useLatestRequest } from "@/hooks/useLatestRequest"
import { anomalyService, type AnomalyQuery } from "@/services/anomalyService"

/** Emission-intensity investigation signal of a factory; responses for a previous factory are ignored. */
export function useAnomalySignal(factoryId: number | undefined, query?: AnomalyQuery) {
  const threshold = query?.threshold
  const baselineDays = query?.baselineDays
  const fetcher = useMemo(
    () =>
      factoryId
        ? async () => ({ factoryId, signal: await anomalyService.getAnomalySignal(factoryId, { threshold, baselineDays }) })
        : null,
    [factoryId, threshold, baselineDays]
  )
  const { data, loading, error, reload } = useLatestRequest(fetcher, "The emission intensity signal could not be loaded.")

  return {
    signal: data && data.factoryId === factoryId ? data.signal : null,
    isLoading: loading,
    error,
    refetch: reload,
  }
}
