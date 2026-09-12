import type { ActivitySource } from "@/services/activityService"
import type { EmissionSummaryQuery } from "@/services/emissionService"
import { toIsoDate } from "@/utils/format"

export type DashboardPeriod = "30d" | "6m" | "12m" | "all"

export type DashboardFilterValue = { period: DashboardPeriod; source: "" | ActivitySource }

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterValue = { period: "12m", source: "" }

export const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
]

/**
 * Turns a period preset into the summary query's date range and history granularity. Only
 * calendar dates are derived here; every emission figure comes from the API.
 */
export function toSummaryQuery({ period, source }: DashboardFilterValue, today = new Date()): EmissionSummaryQuery {
  const query: EmissionSummaryQuery = { source: source || undefined, granularity: "month" }
  if (period === "all") return query

  const [year, month, day] = [today.getFullYear(), today.getMonth(), today.getDate()]
  const from = period === "30d" ? new Date(year, month, day - 29) : new Date(year, month - (period === "6m" ? 5 : 11), 1)
  return { ...query, from: toIsoDate(from), to: toIsoDate(today), granularity: period === "30d" ? "day" : "month" }
}
