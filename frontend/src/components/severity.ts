import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react"
import type { Severity } from "@/types/domain"

// Status colors are reserved for severity and always paired with an icon and label.
export const SEVERITY_STYLES: Record<Severity, { dot: string; icon: LucideIcon; label: string }> = {
  CRITICAL: { dot: "bg-status-critical", icon: TriangleAlert, label: "Critical" },
  HIGH: { dot: "bg-status-serious", icon: CircleAlert, label: "High" },
  MEDIUM: { dot: "bg-status-warning", icon: Info, label: "Medium" },
  LOW: { dot: "bg-status-good", icon: CircleCheck, label: "Low" },
}
