import { useCallback, useEffect, useState } from "react"
import { getApiErrorMessage } from "@/services/apiClient"
import { factoryService, type Factory } from "@/services/factoryService"

type Status = "loading" | "ready" | "error"

/** The user's factories and the one currently selected (the first by default). */
export function useFactorySelection() {
  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState<string | null>(null)
  const [factories, setFactories] = useState<Factory[]>([])
  const [factoryId, setFactoryId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const { data } = await factoryService.getFactories()
      setFactories(data)
      setFactoryId((current) => (data.some((factory) => factory.id === current) ? current : (data[0]?.id ?? null)))
      setStatus("ready")
    } catch (err) {
      setError(getApiErrorMessage(err, "Your factories could not be loaded."))
      setStatus("error")
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load()
  }, [load])

  return {
    status,
    error,
    factories,
    factory: factories.find((factory) => factory.id === factoryId) ?? null,
    selectFactory: setFactoryId,
    reload: load,
  }
}
