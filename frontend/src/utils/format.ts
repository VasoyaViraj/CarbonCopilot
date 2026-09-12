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
