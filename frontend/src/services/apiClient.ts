import axios, { isAxiosError } from "axios"
import { tokenStorage } from "@/services/tokenStorage"

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api"

/** Single HTTP client for the Express API. Components never call fetch/axios directly. */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20_000,
})

/** Success envelope: { success: true, data }. */
export type ApiSuccess<T> = { success: true; data: T }

/** Error envelope: { success: false, error: { code, message, details? } }. */
export type ApiErrorBody = {
  success: false
  error: { code: string; message: string; details?: { field: string; message: string }[] }
}

let unauthorizedHandler: (() => void) | null = null

/** Registered by the auth provider: invoked when an authenticated request is rejected with 401. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginAttempt = isAxiosError(error) && error.config?.url?.startsWith("/auth/login")
    if (isAxiosError(error) && error.response?.status === 401 && !isLoginAttempt) {
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  }
)

/** Extracts a user-facing message from any thrown API error. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error?.message
    if (message) return message
    if (!error.response) return "Cannot reach the server. Check your connection and try again."
  }
  return fallback
}

/** Maps validation error details to { field: message } for inline form errors. */
export function getApiFieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError<ApiErrorBody>(error)) return {}
  const details = error.response?.data?.error?.details ?? []
  return Object.fromEntries(details.map((detail) => [detail.field, detail.message]))
}
