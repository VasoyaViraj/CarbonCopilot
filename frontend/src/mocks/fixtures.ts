/**
 * TEMPORARY UI SCAFFOLDING — NOT REAL FACTORY DATA.
 *
 * Illustrative values from the project specification, used only so screens can be
 * built before the APIs exist. Every screen that renders these shows <MockDataNotice />.
 * Replace each import with API-backed data during frontend integration; never
 * import this module from services, hooks, or shared components.
 */
import type { CostLevel } from "@/types/domain"

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
