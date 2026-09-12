import { useCallback, useEffect, useRef, useState } from "react"
import { getApiErrorMessage } from "@/services/apiClient"

/**
 * Runs `fetcher` whenever it changes (memoize it with useMemo; pass null to skip). The last
 * result is kept while a newer request runs, so screens do not flash empty, and responses that
 * arrive after a newer request are ignored.
 */
export function useLatestRequest<T>(fetcher: (() => Promise<T>) | null, errorMessage: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestRequest = useRef(0)

  const load = useCallback(async () => {
    if (!fetcher) return
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const result = await fetcher()
      if (requestId !== latestRequest.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (requestId === latestRequest.current) setError(getApiErrorMessage(err, errorMessage))
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [fetcher, errorMessage])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when the request changes
    load()
  }, [load])

  return { data, loading, error, reload: load }
}
