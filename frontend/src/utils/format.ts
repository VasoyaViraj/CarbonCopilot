// Display formatting only. Authoritative calculations always come from the API.

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value)
}

export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return `${formatNumber(value, maximumFractionDigits)}%`
}

export function formatYears(value: number | null | undefined): string {
  return value == null ? "N/A" : `${formatNumber(value, 1)} years`
}

/** Local calendar date as YYYY-MM-DD (the value format of <input type="date">). */
export function toIsoDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Date-only activities are stored at UTC midnight and shown as that calendar day in every
 * timezone; timestamped (simulated) readings are shown in local time.
 */
export function formatActivityDate(iso: string): string {
  const date = new Date(iso)
  if (iso.endsWith("T00:00:00.000Z")) {
    return date.toLocaleDateString("en-US", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })
  }
  return date.toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
