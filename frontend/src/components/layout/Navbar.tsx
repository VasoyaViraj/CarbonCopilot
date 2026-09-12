import type { ReactNode } from "react"
import { useLocation } from "react-router"
import { Menu } from "lucide-react"
import { NAV_ITEMS } from "@/layouts/navigation"

type NavbarProps = { onMenuClick: () => void; actions?: ReactNode }

export default function Navbar({ onMenuClick, actions }: NavbarProps) {
  const { pathname } = useLocation()
  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.to))

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
      <button type="button" onClick={onMenuClick} className="rounded-md p-1.5 hover:bg-muted lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <p className="text-sm font-medium text-muted-foreground">{current?.label ?? "EcoTrace AI"}</p>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  )
}
