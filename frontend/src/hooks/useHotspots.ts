import { useMemo } from "react"
import { useLatestRequest } from "@/hooks/useLatestRequest"
import { hotspotService, type HotspotQuery } from "@/services/hotspotService"

/** Ranked hotspots of a factory, refetched when the filters change. */
export function useHotspots(factoryId: number | null, { from, to, source }: HotspotQuery) {
  const fetcher = useMemo(
    () => (factoryId == null ? null : () => hotspotService.getRanking(factoryId, { from, to, source })),
    [factoryId, from, to, source]
  )
  const { data, ...state } = useLatestRequest(fetcher, "Hotspots could not be loaded.")
  return { ranking: data, ...state }
}

/** Detail of the selected process; nothing is fetched while no process is selected. */
export function useHotspotDetail(factoryId: number | null, processId: number | null, { from, to, source }: HotspotQuery) {
  const fetcher = useMemo(
    () =>
      factoryId == null || processId == null ? null : () => hotspotService.getDetail(factoryId, processId, { from, to, source }),
    [factoryId, processId, from, to, source]
  )
  const { data, ...state } = useLatestRequest(fetcher, "Process details could not be loaded.")
  return { detail: data, ...state }
}
