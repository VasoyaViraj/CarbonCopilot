import { useMemo } from "react"
import { useLatestRequest } from "@/hooks/useLatestRequest"
import { reportService } from "@/services/reportService"

/** Carbon assessment report of a factory; responses for a previously selected factory are ignored. */
export function useReport(factoryId: number | null) {
  const fetcher = useMemo(() => (factoryId == null ? null : () => reportService.getReport(factoryId)), [factoryId])
  const { data, ...state } = useLatestRequest(fetcher, "The report could not be loaded.")
  return { report: data, ...state }
}
