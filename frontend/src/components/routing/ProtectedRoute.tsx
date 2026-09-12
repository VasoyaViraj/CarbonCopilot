import type { ReactNode } from "react"

/**
 * Placeholder guard. Authentication (token check, redirect to /login) is wired in
 * the auth phase; the backend remains authoritative for all authorization.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  return <>{children}</>
}
