import { useCallback, useMemo, useState } from "react"
import { useLatestRequest } from "@/hooks/useLatestRequest"
import { getApiErrorMessage } from "@/services/apiClient"
import { recommendationService, type RecommendationRun } from "@/services/recommendationService"

/** Stored recommendations of a factory plus a `generate` action that re-scores them on the backend. */
export function useRecommendations(factoryId: number | null) {
  const fetcher = useMemo(() => (factoryId == null ? null : () => recommendationService.list(factoryId)), [factoryId])
  const { data, loading, error, reload } = useLatestRequest(fetcher, "Recommendations could not be loaded.")

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<RecommendationRun | null>(null)

  const generate = useCallback(async () => {
    if (factoryId == null) return
    setGenerating(true)
    setGenerateError(null)
    try {
      setLastRun(await recommendationService.generate(factoryId))
      await reload()
    } catch (err) {
      setGenerateError(getApiErrorMessage(err, "Recommendations could not be generated."))
    } finally {
      setGenerating(false)
    }
  }, [factoryId, reload])

  return {
    list: data,
    loading,
    error,
    reload,
    generate,
    generating,
    generateError,
    // Details of the latest run in this session, only for the factory it was run for.
    lastRun: lastRun && lastRun.factory.id === factoryId ? lastRun : null,
  }
}
