import { useCallback, useEffect, useState } from "react"
import { getApiErrorMessage } from "@/services/apiClient"
import { activityService, type ActivityCatalog } from "@/services/activityService"
import { factoryService, type Factory, type Process } from "@/services/factoryService"

type Status = "loading" | "ready" | "error"

/** Loads what the Data Input screen needs: the user's factories, the selected factory's processes and the activity catalog. */
export function useDataInputContext() {
  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState<string | null>(null)
  const [factories, setFactories] = useState<Factory[]>([])
  const [factoryId, setFactoryId] = useState<number | null>(null)
  const [processes, setProcesses] = useState<Process[]>([])
  const [catalog, setCatalog] = useState<ActivityCatalog | null>(null)

  const load = useCallback(async (preferredFactoryId?: number | null) => {
    setStatus("loading")
    setError(null)
    try {
      const [{ data: factoryList }, activityCatalog] = await Promise.all([
        factoryService.getFactories(),
        activityService.getCatalog(),
      ])
      const selected = factoryList.find((factory) => factory.id === preferredFactoryId) ?? factoryList[0] ?? null
      const processList = selected ? (await factoryService.getProcesses(selected.id)).data : []
      setFactories(factoryList)
      setFactoryId(selected?.id ?? null)
      setProcesses([...processList].sort((a, b) => a.name.localeCompare(b.name)))
      setCatalog(activityCatalog)
      setStatus("ready")
    } catch (err) {
      setError(getApiErrorMessage(err, "The factory data could not be loaded."))
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
    processes,
    catalog,
    selectFactory: (id: number) => load(id),
    reload: () => load(factoryId),
  }
}
