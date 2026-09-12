import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type LoadingStateProps = { label?: string; className?: string }

export default function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}>
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  )
}
