import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router"
import LoadingState from "@/components/feedback/LoadingState"
import ErrorState from "@/components/feedback/ErrorState"
import { useAuth } from "@/hooks/useAuth"
import type { Role } from "@/types/domain"

type ProtectedRouteProps = {
  children: ReactNode
  /** Optional role gate. UX only — the backend remains authoritative for authorization. */
  roles?: Role[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === "loading") {
    return <LoadingState label="Restoring your session…" className="min-h-svh" />
  }

  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <ErrorState title="Not authorized" message="Your role does not have access to this page." className="min-h-[60vh]" />
  }

  return <>{children}</>
}
