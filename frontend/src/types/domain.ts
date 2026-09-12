import type { CopilotResponse } from "@/services/aiService"

export type Role = "ADMIN" | "FACTORY_OPERATOR" | "CONSULTANT" | "REGULATOR"

export type AuthUser = {
  id: number
  name: string
  email: string
  role: Role
  organizationId: number
}

export type Severity ="CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export type CostLevel = "LOW" | "MEDIUM" | "HIGH"

export type ChatRole = "user" | "assistant" | "system"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  toolsUsed?: string[]
  /** Structured copilot answer for assistant messages. */
  response?: CopilotResponse
}
