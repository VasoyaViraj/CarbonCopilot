import { Bot, Database, Factory, FileText, Flame, LayoutDashboard, Recycle, SlidersHorizontal, type LucideIcon } from "lucide-react"

export type NavItem = { to: string; label: string; icon: LucideIcon }

/** Ordered by the product workflow: data → measurement → analysis → action → report. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/factory", label: "Factory Setup", icon: Factory },
  { to: "/data", label: "Data Input", icon: Database },
  { to: "/dashboard", label: "Carbon Dashboard", icon: LayoutDashboard },
  { to: "/hotspots", label: "Hotspot Analysis", icon: Flame },
  { to: "/recommendations", label: "Circular Recommendations", icon: Recycle },
  { to: "/scenarios", label: "What-if Simulator", icon: SlidersHorizontal },
  { to: "/copilot", label: "AI Copilot", icon: Bot },
  { to: "/reports", label: "Reports", icon: FileText },
]
