import { FileSpreadsheet, FlaskConical, PencilLine } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ActivitySource } from "@/services/activityService"

/** Provenance label for an activity. Simulated data is always called out explicitly (BR-12). */
export default function ActivitySourceBadge({ source }: { source: ActivitySource }) {
  if (source === "SIMULATION") {
    return (
      <Badge title="Synthetic reading from the simulator — not a physical sensor measurement">
        <FlaskConical aria-hidden /> Simulated
      </Badge>
    )
  }
  if (source === "CSV") {
    return (
      <Badge variant="muted">
        <FileSpreadsheet aria-hidden /> CSV
      </Badge>
    )
  }
  return (
    <Badge variant="outline">
      <PencilLine aria-hidden /> Manual
    </Badge>
  )
}
