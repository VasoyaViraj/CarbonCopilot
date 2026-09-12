import { cn } from "@/lib/utils"

type Tab = { id: string; label: string }

type TabsProps = {
  tabs: Tab[]
  value: string
  onChange: (id: string) => void
  label: string
  className?: string
}

function Tabs({ tabs, value, onChange, label, className }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex rounded-lg border bg-muted p-1", className)}>
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              selected ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export { Tabs }
