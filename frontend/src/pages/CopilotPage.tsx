import { useState } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import ChatWindow from "@/components/ChatWindow"
import FactorySelect from "@/components/FactorySelect"
import AiAnswer from "@/components/ai/AiAnswer"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { getApiErrorMessage } from "@/services/apiClient"
import { aiService } from "@/services/aiService"
import type { ChatMessage } from "@/types/domain"

const SUGGESTIONS = [
  "Why is my furnace a hotspot?",
  "What should I fix first?",
  "What happens if I use 30% recycled material?",
  "Generate an action plan.",
]

let messageSeq = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++messageSeq}`

export default function CopilotPage() {
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  // One conversation per factory, so answers never mix factories.
  const [conversations, setConversations] = useState<Record<number, ChatMessage[]>>({})
  const [pendingFactoryId, setPendingFactoryId] = useState<number | null>(null)
  const factoryId = factory?.id ?? null
  const messages = factoryId ? (conversations[factoryId] ?? []) : []

  const append = (id: number, ...added: ChatMessage[]) =>
    setConversations((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), ...added] }))

  async function onSend(text: string) {
    if (!factoryId) return
    const id = factoryId
    append(id, { id: nextId("u"), role: "user", content: text })
    setPendingFactoryId(id)
    try {
      const response = await aiService.askCopilot(id, text)
      append(id, { id: nextId("a"), role: "assistant", content: response.answer, response })
    } catch (err) {
      append(id, {
        id: nextId("e"),
        role: "system",
        content: getApiErrorMessage(err, "The AI Copilot could not answer. Please try again."),
      })
    } finally {
      setPendingFactoryId((current) => (current === id ? null : current))
    }
  }

  let content
  if (status === "loading") {
    content = <LoadingState label="Loading factories…" />
  } else if (status === "error") {
    content = <ErrorState message={error ?? undefined} onRetry={reload} />
  } else if (!factory) {
    content = (
      <Card>
        <EmptyState
          icon={FactoryIcon}
          title="Set up a factory first"
          description="The copilot answers questions using a factory's recorded data."
          action={
            <Link to="/factory" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Factory Setup
            </Link>
          }
        />
      </Card>
    )
  } else {
    content = (
      <ChatWindow
        messages={messages}
        onSend={onSend}
        loading={pendingFactoryId === factory.id}
        suggestions={SUGGESTIONS}
        renderContent={(message) => (message.response ? <AiAnswer response={message.response} /> : undefined)}
        footerNote={`Answers use ${factory.name}'s available data and deterministic tool results — estimates and decision support, not guaranteed outcomes.`}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="AI Copilot"
        description="Ask questions about your factory. Answers are grounded in your factory's available data and deterministic tool results."
        actions={factory && <FactorySelect factories={factories} value={factory.id} onChange={selectFactory} />}
      />
      {content}
    </>
  )
}
