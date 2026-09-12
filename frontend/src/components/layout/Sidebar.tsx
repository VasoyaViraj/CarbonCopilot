import { NavLink } from "react-router"
import { Leaf, X } from "lucide-react"
import { NAV_ITEMS } from "@/layouts/navigation"
import { cn } from "@/lib/utils"

type SidebarProps = { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-svh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Leaf className="size-4" aria-hidden />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-sidebar-accent-foreground">EcoTrace AI</p>
              <p className="text-[11px] text-sidebar-foreground/70">Carbon decision support</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-sidebar-accent lg:hidden" aria-label="Close navigation">
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("size-4", isActive && "text-sidebar-primary")} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <p className="px-5 py-4 text-[11px] leading-relaxed text-sidebar-foreground/60">
          Manual, CSV and simulated data. Software-based analysis — no physical sensors.
        </p>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
    </>
  )
}
