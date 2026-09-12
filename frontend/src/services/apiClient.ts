import axios, { isAxiosError } from "axios"

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api"

/** Single HTTP client for the Express API. Components never call fetch/axios directly. */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20_000,
})

/** Shape of the backend error contract: { success: false, error: { code, message, details? } }. */
export type ApiErrorBody = {
  success: false
  error: { code: string; message: string; details?: unknown }
}

/** Extracts a user-facing message from any thrown API error. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error?.message
    if (message) return message
    if (!error.response) return "Cannot reach the server. Check your connection and try again."
  }
  return fallback
}
