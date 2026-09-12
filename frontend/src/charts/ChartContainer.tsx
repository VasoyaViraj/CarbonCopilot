import type { ReactNode } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import LoadingState from "@/components/feedback/LoadingState"
import ErrorState from "@/components/feedback/ErrorState"
import EmptyState from "@/components/feedback/EmptyState"

type ChartContainerProps = {
  title: string
  description?: string
  actions?: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  isEmpty?: boolean
  emptyMessage?: string
  height?: number
  children: ReactNode
}

/** Card frame for every chart: title, and consistent loading / error / empty handling. */
export default function ChartContainer({
  title,
  description,
  actions,
  loading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyMessage = "No data for this period yet.",
  height = 260,
  children,
}: ChartContainerProps) {
  let body: ReactNode = children
  if (loading) body = <LoadingState />
  else if (error) body = <ErrorState message={error} onRetry={onRetry} />
  else if (isEmpty) body = <EmptyState title="Nothing to show" description={emptyMessage} />

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <div className="px-3 pt-3 pb-4" style={{ height }}>
        {body}
      </div>
    </Card>
  )
}
