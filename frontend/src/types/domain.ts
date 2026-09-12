export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export type CostLevel = "LOW" | "MEDIUM" | "HIGH"

export type ChatRole = "user" | "assistant" | "system"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  toolsUsed?: string[]
}
