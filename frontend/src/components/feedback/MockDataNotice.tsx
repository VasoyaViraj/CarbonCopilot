import { FlaskConical } from "lucide-react"
import { Badge } from "@/components/ui/badge"

/** Marks screens that still render temporary scaffolding data instead of API data. */
export default function MockDataNotice() {
  return (
    <Badge variant="outline" title="Temporary UI scaffolding — not calculated from your factory data">
      <FlaskConical aria-hidden /> Sample data · UI preview
    </Badge>
  )
}
