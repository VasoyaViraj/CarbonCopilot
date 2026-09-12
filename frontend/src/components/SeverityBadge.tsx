import { SEVERITY_STYLES } from "@/components/severity"
import type { Severity } from "@/types/domain"

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const { dot, icon: Icon, label } = SEVERITY_STYLES[severity]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs font-medium">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {label}
    </span>
  )
}
