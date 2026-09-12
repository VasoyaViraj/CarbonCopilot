import { Info } from "lucide-react"

type NotConnectedNoticeProps = { children?: string }

/** Shown on scaffolded screens whose actions are not yet wired to the backend. */
export default function NotConnectedNotice({ children = "This screen is not connected to the backend yet." }: NotConnectedNoticeProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
