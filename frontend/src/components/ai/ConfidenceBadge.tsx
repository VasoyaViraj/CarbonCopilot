import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ConfidenceLevel } from "@/services/aiService"

const STYLES: Record<ConfidenceLevel, string> = {
  HIGH: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  MEDIUM: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  LOW: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  UNAVAILABLE: "bg-muted text-muted-foreground",
}

const LABELS: Record<ConfidenceLevel, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
  UNAVAILABLE: "Insufficient data",
}

export default function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const known = level in STYLES ? level : "UNAVAILABLE"
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[known])}>
      {LABELS[known]}
    </Badge>
  )
}
