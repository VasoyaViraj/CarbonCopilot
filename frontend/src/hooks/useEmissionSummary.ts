import { useCallback, useEffect, useRef, useState } from "react"
import { getApiErrorMessage } from "@/services/apiClient"
import { emissionService, type EmissionSummary, type EmissionSummaryQuery } from "@/services/emissionService"

/**
 * Loads the dashboard summary for a factory and refetches when the filters change. The last
 * loaded summary is kept while a refetch runs, so the screen does not flash empty.
 */
export function useEmissionSummary(factoryId: number | null, { from, to, source, granularity }: EmissionSummaryQuery) {
  const [summary, setSummary] = useState<EmissionSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestRequest = useRef(0)

  const load = useCallback(async () => {
    if (factoryId == null) return
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const result = await emissionService.getSummary(factoryId, { from, to, source, granularity })
      // Ignore responses that arrive after a newer request (e.g. quick filter changes).
      if (requestId !== latestRequest.current) return
      setSummary(result)
      setError(null)
    } catch (err) {
      if (requestId === latestRequest.current) setError(getApiErrorMessage(err, "Emission data could not be loaded."))
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [factoryId, from, to, source, granularity])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on factory/filter change
    load()
  }, [load])

  return { summary, loading, error, reload: load }
}
