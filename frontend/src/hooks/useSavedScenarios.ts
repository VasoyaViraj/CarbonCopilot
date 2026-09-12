import { useCallback, useEffect, useRef, useState } from "react"
import { getApiErrorMessage } from "@/services/apiClient"
import { scenarioService, type SavedScenario, type ScenarioInput } from "@/services/scenarioService"

/** Saved what-if scenarios of the selected factory, newest first. */
export function useSavedScenarios(factoryId: number | undefined) {
  const [list, setList] = useState<{ factoryId: number; items: SavedScenario[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const activeFactoryId = useRef(factoryId)

  useEffect(() => {
    activeFactoryId.current = factoryId
  }, [factoryId])

  const load = useCallback(async () => {
    if (!factoryId) return
    const requested = factoryId
    setLoading(true)
    setError(null)
    try {
      const items = await scenarioService.list(requested)
      if (activeFactoryId.current === requested) setList({ factoryId: requested, items })
    } catch (err) {
      if (activeFactoryId.current === requested) setError(getApiErrorMessage(err, "Saved scenarios could not be loaded."))
    } finally {
      if (activeFactoryId.current === requested) setLoading(false)
    }
  }, [factoryId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load()
  }, [load])

  const save = useCallback(
    async (input: ScenarioInput & { name: string }) => {
      if (!factoryId) return false
      const requested = factoryId
      setSaving(true)
      setSaveError(null)
      try {
        const scenario = await scenarioService.save(requested, input)
        setList((prev) => ({
          factoryId: requested,
          items: [scenario, ...(prev && prev.factoryId === requested ? prev.items : [])],
        }))
        return true
      } catch (err) {
        setSaveError(getApiErrorMessage(err, "The scenario could not be saved."))
        return false
      } finally {
        setSaving(false)
      }
    },
    [factoryId]
  )

  return {
    items: list && list.factoryId === factoryId ? list.items : null,
    loading,
    error,
    reload: load,
    save,
    saving,
    saveError,
  }
}
