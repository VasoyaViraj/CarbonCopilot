import { useState, useEffect, useCallback } from "react"
import { anomalyService, type AnomalySignal, type AnomalyQuery } from "@/services/anomalyService"
import { getApiErrorMessage } from "@/services/apiClient"

export function useAnomalySignal(factoryId: number | undefined, query?: AnomalyQuery) {
  const [signal, setSignal] = useState<AnomalySignal | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threshold = query?.threshold
  const baselineDays = query?.baselineDays

  const fetchSignal = useCallback(async () => {
    if (!factoryId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await anomalyService.getAnomalySignal(factoryId, { threshold, baselineDays })
      setSignal(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [factoryId, threshold, baselineDays])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when the factory or query changes
    fetchSignal()
  }, [fetchSignal])

  return { signal, isLoading, error, refetch: fetchSignal }
}
