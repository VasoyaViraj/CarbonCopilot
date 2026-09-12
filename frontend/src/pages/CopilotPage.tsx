import { useState } from "react"
import PageHeader from "@/components/PageHeader"
import ChatWindow from "@/components/ChatWindow"
import type { ChatMessage } from "@/types/domain"

const SUGGESTIONS = [
  "Why is my furnace a hotspot?",
  "What should I fix first?",
  "What happens if I use 30% recycled material?",
  "Generate an action plan.",
]

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  function onSend(text: string) {
    const now = Date.now()
    setMessages((prev) => [
      ...prev,
      { id: `u-${now}`, role: "user", content: text },
      { id: `s-${now}`, role: "system", content: "The AI Copilot service is not connected yet, so no answer was generated." },
    ])
  }

  return (
    <>
      <PageHeader
        title="AI Copilot"
        description="Ask questions about your factory. Answers are grounded in your factory's available data and deterministic tool results."
      />
      <ChatWindow
        messages={messages}
        onSend={onSend}
        suggestions={SUGGESTIONS}
        footerNote="AI answers are decision support based on your factory's available data — estimates, not guaranteed outcomes."
      />
    </>
  )
}
