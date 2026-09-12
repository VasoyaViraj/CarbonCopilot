import { apiClient, type ApiSuccess } from "@/services/apiClient"
import type { AuthUser, Role } from "@/types/domain"

export type AuthResult = { accessToken: string; user: AuthUser }

export type RegisterInput = {
  name: string
  email: string
  password: string
  role: Exclude<Role, "ADMIN">
  organizationName?: string
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiSuccess<AuthResult>>("/auth/login", { email, password })
    return data.data
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiSuccess<AuthResult>>("/auth/register", input)
    return data.data
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<ApiSuccess<{ user: AuthUser }>>("/auth/me")
    return data.data.user
  },

  async logout(): Promise<void> {
    await apiClient.post("/auth/logout")
  },
}
