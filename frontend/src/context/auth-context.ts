import { createContext } from "react"
import type { RegisterInput } from "@/services/authService"
import type { AuthUser } from "@/types/domain"

export type AuthStatus = "loading" | "authenticated" | "unauthenticated"

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
