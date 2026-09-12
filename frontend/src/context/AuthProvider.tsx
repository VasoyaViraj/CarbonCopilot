import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { AuthContext, type AuthContextValue, type AuthStatus } from "@/context/auth-context"
import { setUnauthorizedHandler } from "@/services/apiClient"
import { authService, type AuthResult, type RegisterInput } from "@/services/authService"
import { tokenStorage } from "@/services/tokenStorage"
import type { AuthUser } from "@/types/domain"

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (tokenStorage.get() ? "loading" : "unauthenticated"))

  const clearSession = useCallback(() => {
    tokenStorage.clear()
    setUser(null)
    setStatus("unauthenticated")
  }, [])

  const startSession = useCallback((result: AuthResult) => {
    tokenStorage.set(result.accessToken)
    setUser(result.user)
    setStatus("authenticated")
  }, [])

  // Any 401 from an authenticated request ends the session; ProtectedRoute then redirects to /login.
  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  // Restore the current user from a stored token on first load.
  useEffect(() => {
    if (!tokenStorage.get()) return
    let cancelled = false
    authService
      .me()
      .then((current) => {
        if (cancelled) return
        setUser(current)
        setStatus("authenticated")
      })
      .catch(() => {
        if (!cancelled) clearSession()
      })
    return () => {
      cancelled = true
    }
  }, [clearSession])

  const login = useCallback(
    async (email: string, password: string) => startSession(await authService.login(email, password)),
    [startSession]
  )

  const register = useCallback(
    async (input: RegisterInput) => startSession(await authService.register(input)),
    [startSession]
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      // Server-side logout only clears the cookie; the local session is cleared regardless.
    }
    clearSession()
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
