/**
 * TEMPORARY UI SCAFFOLDING — NOT REAL FACTORY DATA.
 *
 * Illustrative values from the project specification, used only so screens can be
 * built before the APIs exist. Every screen that renders these shows <MockDataNotice />.
 * Replace each import with API-backed data during frontend integration; never
 * import this module from services, hooks, or shared components.
 */
import type { CostLevel, Severity } from "@/types/domain"

export const mockKpis = {
  totalEmissions: 1250,
  emissionUnit: "tCO2e",
  production: 10000,
  productionUnit: "tonnes",
  emissionIntensity: 0.125,
  intensityUnit: "tCO2e/tonne",
}

export const mockEmissionsByProcess = [
  { label: "Furnace", value: 520 },
  { label: "Electricity", value: 250 },
  { label: "Boiler", value: 180 },
  { label: "Transport", value: 80 },
  { label: "Waste", value: 70 },
]

export const mockEmissionsBySource = [
  { label: "Natural gas", value: 610 },
  { label: "Electricity", value: 430 },
  { label: "Diesel", value: 110 },
  { label: "Waste", value: 70 },
  { label: "Materials", value: 30 },
]

export const mockEmissionHistory = [
  { label: "Apr", value: 98 },
  { label: "May", value: 104 },
  { label: "Jun", value: 101 },
  { label: "Jul", value: 110 },
  { label: "Aug", value: 106 },
  { label: "Sep", value: 104 },
]

export const mockElectricityHistory = [
  { label: "Apr", value: 68000 },
  { label: "May", value: 71000 },
  { label: "Jun", value: 70500 },
  { label: "Jul", value: 74200 },
  { label: "Aug", value: 72100 },
  { label: "Sep", value: 70900 },
]

export const mockHotspots: {
  processId: number
  process: string
  emission: number
  percentage: number
  severity: Severity
}[] = [
  { processId: 1, process: "Furnace", emission: 520, percentage: 47, severity: "CRITICAL" },
  { processId: 2, process: "Electricity", emission: 250, percentage: 22, severity: "MEDIUM" },
  { processId: 3, process: "Boiler", emission: 180, percentage: 16, severity: "MEDIUM" },
  { processId: 4, process: "Transport", emission: 80, percentage: 7, severity: "LOW" },
  { processId: 5, process: "Waste", emission: 70, percentage: 6, severity: "LOW" },
]

export const mockRecommendations: {
  id: number
  title: string
  category: string
  reductionPercent: number
  costLevel: CostLevel
  paybackYears: number | null
  score: number
  reason: string
}[] = [
  {
    id: 1,
    title: "Waste Heat Recovery",
    category: "Energy efficiency",
    reductionPercent: 12,
    costLevel: "MEDIUM",
    paybackYears: 2.4,
    score: 91,
    reason: "Targets the largest thermal hotspot (furnace).",
  },
  {
    id: 2,
    title: "Furnace Efficiency Upgrade",
    category: "Process optimization",
    reductionPercent: 8,
    costLevel: "MEDIUM",
    paybackYears: 3.1,
    score: 84,
    reason: "Reduces natural gas use per tonne produced.",
  },
  {
    id: 3,
    title: "Recycled Aluminum",
    category: "Material",
    reductionPercent: 15,
    costLevel: "MEDIUM",
    paybackYears: 2.5,
    score: 79,
    reason: "Replaces virgin aluminum with lower-carbon feedstock.",
  },
]
