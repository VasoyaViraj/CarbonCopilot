import { useState, useEffect, useCallback } from "react"
import { anomalyService, type AnomalySignal, type AnomalyQuery } from "@/services/anomalyService"
import { getApiErrorMessage } from "@/services/apiClient"

export function useAnomalySignal(factoryId: number | undefined, query?: AnomalyQuery) {
  const [signal, setSignal] = useState<AnomalySignal | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSignal = useCallback(async () => {
    if (!factoryId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await anomalyService.getAnomalySignal(factoryId, query)
      setSignal(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [factoryId, query?.threshold, query?.baselineDays])

  useEffect(() => {
    fetchSignal()
  }, [fetchSignal])

  return { signal, isLoading, error, refetch: fetchSignal }
}
