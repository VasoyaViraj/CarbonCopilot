import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon, TriangleAlert } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import ChatWindow from "@/components/ChatWindow"
import FactorySelect from "@/components/FactorySelect"
import AiAnswer from "@/components/ai/AiAnswer"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useLatestRequest } from "@/hooks/useLatestRequest"
import { getApiErrorMessage } from "@/services/apiClient"
import { aiService } from "@/services/aiService"
import type { ChatMessage } from "@/types/domain"

const SUGGESTIONS = [
  "Why is my furnace a hotspot?",
  "What should I fix first?",
  "What happens if I use 30% recycled material?",
  "Generate an action plan.",
]

/** Messages exchanged in this session, after the restored history. */
type Session = { conversationId: number | null; messages: ChatMessage[] }
const EMPTY_SESSION: Session = { conversationId: null, messages: [] }

let messageSeq = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++messageSeq}`

export default function CopilotPage() {
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  const factoryId = factory?.id ?? null

  // The latest saved conversation of the selected factory.
  const historyFetcher = useMemo(
    () => (factoryId == null ? null : async () => ({ factoryId, ...(await aiService.getHistory(factoryId)) })),
    [factoryId]
  )
  const history = useLatestRequest(historyFetcher, "Earlier messages could not be loaded.")
  const restored = history.data && history.data.factoryId === factoryId ? history.data : null

  // One session per factory, so answers never mix factories.
  const [sessions, setSessions] = useState<Record<number, Session>>({})
  const [pendingFactoryId, setPendingFactoryId] = useState<number | null>(null)
  const session = (factoryId != null && sessions[factoryId]) || EMPTY_SESSION
  const messages = [...(restored?.messages ?? []), ...session.messages]
  const conversationId = session.conversationId ?? restored?.conversationId ?? null

  const update = (id: number, change: (current: Session) => Session) =>
    setSessions((prev) => ({ ...prev, [id]: change(prev[id] ?? EMPTY_SESSION) }))

  async function onSend(text: string) {
    if (factoryId == null) return
    const id = factoryId
    const activeConversation = conversationId
    update(id, (current) => ({ ...current, messages: [...current.messages, { id: nextId("u"), role: "user", content: text }] }))
    setPendingFactoryId(id)
    try {
      const response = await aiService.askCopilot(id, text, activeConversation)
      update(id, (current) => ({
        conversationId: response.conversationId ?? current.conversationId,
        messages: [...current.messages, { id: nextId("a"), role: "assistant", content: response.answer, response }],
      }))
    } catch (err) {
      const content = getApiErrorMessage(err, "The AI Copilot could not answer. Please try again.")
      update(id, (current) => ({ ...current, messages: [...current.messages, { id: nextId("e"), role: "system", content }] }))
    } finally {
      setPendingFactoryId((current) => (current === id ? null : current))
    }
  }

  const retryHistory = () => {
    // The reloaded history already contains anything sent in this session.
    if (factoryId != null) setSessions((prev) => ({ ...prev, [factoryId]: EMPTY_SESSION }))
    void history.reload()
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
  } else if (!restored && history.loading) {
    content = <LoadingState label="Loading conversation…" />
  } else {
    content = (
      <>
        {!restored && history.error && (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert />
            <AlertTitle>Earlier messages could not be loaded</AlertTitle>
            <AlertDescription>
              {history.error} You can still ask new questions.{" "}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={retryHistory}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <ChatWindow
          messages={messages}
          onSend={onSend}
          loading={pendingFactoryId === factory.id}
          suggestions={SUGGESTIONS}
          renderContent={(message) => (message.response ? <AiAnswer response={message.response} /> : undefined)}
          footerNote={`Answers use ${factory.name}'s available data and deterministic tool results — estimates and decision support, not guaranteed outcomes.`}
        />
      </>
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
