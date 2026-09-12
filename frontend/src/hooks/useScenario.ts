import { useCallback, useEffect, useRef, useState } from "react"
import { scenarioService, type ScenarioInput, type ScenarioResult } from "@/services/scenarioService"
import { getApiErrorMessage } from "@/services/apiClient"

export function useScenario(factoryId: number | undefined) {
  const [result, setResult] = useState<{ factoryId: number; data: ScenarioResult } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const activeFactoryId = useRef(factoryId)

  useEffect(() => {
    activeFactoryId.current = factoryId
    requestId.current += 1
  }, [factoryId])

  const calculate = useCallback(async (input: ScenarioInput) => {
    if (!factoryId) return
    const requestedFactoryId = factoryId
    const currentRequest = ++requestId.current
    setIsLoading(true)
    setError(null)
    try {
      const data = await scenarioService.calculate(requestedFactoryId, input)
      if (currentRequest !== requestId.current || activeFactoryId.current !== requestedFactoryId) return
      setResult({ factoryId: requestedFactoryId, data })
    } catch (err) {
      if (currentRequest === requestId.current && activeFactoryId.current === requestedFactoryId) setError(getApiErrorMessage(err))
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false)
    }
  }, [factoryId])

  const visibleResult = result && result.factoryId === factoryId ? result.data : null

  return { result: visibleResult, isLoading, error, calculate }
}
