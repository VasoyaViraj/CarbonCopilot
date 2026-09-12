import { useCallback, useRef, useState } from "react"
import { getApiErrorMessage } from "@/services/apiClient"
import { aiService, type CopilotResponse } from "@/services/aiService"

type RequestState = {
  factoryId: number
  message: string
  loading: boolean
  response: CopilotResponse | null
  error: string | null
}

/** One copilot question at a time for the selected factory (AI Analysis, action plan). */
export function useCopilotRequest(factoryId: number | null) {
  const [state, setState] = useState<RequestState | null>(null)
  const requestId = useRef(0)

  const ask = useCallback(
    async (message: string) => {
      if (!factoryId) return
      const id = ++requestId.current
      setState({ factoryId, message, loading: true, response: null, error: null })
      try {
        const response = await aiService.askCopilot(factoryId, message)
        if (id === requestId.current) setState({ factoryId, message, loading: false, response, error: null })
      } catch (err) {
        if (id === requestId.current) {
          const error = getApiErrorMessage(err, "The AI Copilot could not answer. Please try again.")
          setState({ factoryId, message, loading: false, response: null, error })
        }
      }
    },
    [factoryId]
  )

  const reset = useCallback(() => {
    requestId.current += 1
    setState(null)
  }, [])

  // Never show an answer about a previously selected factory.
  const current = state && state.factoryId === factoryId ? state : null
  return {
    message: current?.message ?? null,
    loading: current?.loading ?? false,
    response: current?.response ?? null,
    error: current?.error ?? null,
    ask,
    reset,
  }
}
