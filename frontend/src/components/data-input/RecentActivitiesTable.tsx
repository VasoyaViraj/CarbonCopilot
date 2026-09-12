import { useCallback, useEffect, useRef, useState } from "react"
import DataTable, { type Column } from "@/components/DataTable"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import ActivitySourceBadge from "@/components/data-input/ActivitySourceBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/input"
import { getApiErrorMessage } from "@/services/apiClient"
import {
  activityService,
  type Activity,
  type ActivityCatalog,
  type ActivityPage,
  type ActivitySource,
} from "@/services/activityService"
import { formatActivityDate, formatNumber } from "@/utils/format"

const PAGE_SIZE = 20

const SOURCE_FILTERS: { value: "" | ActivitySource; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "MANUAL", label: "Manual" },
  { value: "CSV", label: "CSV" },
  { value: "SIMULATION", label: "Simulated" },
]

type RecentActivitiesTableProps = {
  factoryId: number
  catalog: ActivityCatalog
  /** Bumped by the page whenever new activities are written. */
  refreshKey: number
}

export default function RecentActivitiesTable({ factoryId, catalog, refreshKey }: RecentActivitiesTableProps) {
  const [page, setPage] = useState<ActivityPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<"" | ActivitySource>("")
  const [offset, setOffset] = useState(0)
  const latestRequest = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current
    try {
      const result = await activityService.listForFactory(factoryId, { limit: PAGE_SIZE, offset, source: source || undefined })
      // Ignore responses that arrive after a newer request (e.g. rapid simulated readings).
      if (requestId !== latestRequest.current) return
      setPage(result)
      setError(null)
    } catch (err) {
      if (requestId === latestRequest.current) setError(getApiErrorMessage(err, "Activities could not be loaded."))
    }
  }, [factoryId, offset, source])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on filter/page/refresh change
    load()
  }, [load, refreshKey])

  const typeLabel = (key: string) => catalog.types.find((type) => type.key === key)?.label ?? key

  const columns: Column<Activity>[] = [
    { key: "date", header: "Date", render: (row) => formatActivityDate(row.activityDate) },
    { key: "process", header: "Process", render: (row) => row.processName ?? `#${row.processId}` },
    { key: "type", header: "Activity", render: (row) => typeLabel(row.energyType) },
    { key: "quantity", header: "Quantity", align: "right", render: (row) => `${formatNumber(row.quantity)} ${row.unit}` },
    {
      key: "production",
      header: "Production",
      align: "right",
      render: (row) => (row.productionQuantity == null ? "—" : `${formatNumber(row.productionQuantity)} ${row.productionUnit ?? ""}`),
    },
    { key: "source", header: "Source", render: (row) => <ActivitySourceBadge source={row.source} /> },
  ]

  const first = page && page.total > 0 ? page.offset + 1 : 0
  const last = page ? page.offset + page.items.length : 0

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Recorded activities</CardTitle>
          <CardDescription>Newest first. Simulated readings are labelled and are never physical sensor data.</CardDescription>
        </div>
        <Select
          aria-label="Filter by source"
          className="w-40"
          value={source}
          onChange={(event) => {
            setSource(event.target.value as "" | ActivitySource)
            setOffset(0)
          }}
        >
          {SOURCE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && !page ? (
          <ErrorState message={error} onRetry={load} />
        ) : !page ? (
          <LoadingState label="Loading activities…" />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={page.items}
              getRowKey={(row) => row.id}
              caption="Recorded operational activities"
              emptyMessage={source ? "No activities from this source yet." : "No activities recorded yet."}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span aria-live="polite">
                {page.total === 0 ? "0 activities" : `Showing ${first}–${last} of ${formatNumber(page.total)}`}
                {error && <span className="ml-2 text-destructive">· {error}</span>}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={last >= page.total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
