import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Bot, LoaderCircle, Send, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/types/domain"

type ChatWindowProps = {
  messages: ChatMessage[]
  onSend: (text: string) => void
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  suggestions?: string[]
  footerNote?: ReactNode
}

export default function ChatWindow({
  messages,
  onSend,
  loading = false,
  disabled = false,
  placeholder = "Ask about your factory's emissions…",
  suggestions = [],
  footerNote,
}: ChatWindowProps) {
  const [draft, setDraft] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, loading])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading || disabled) return
    onSend(trimmed)
    setDraft("")
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    send(draft)
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-xl border bg-card">
      <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && suggestions.length > 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Bot className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Try asking:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <Button key={suggestion} variant="outline" size="sm" onClick={() => send(suggestion)} disabled={disabled}>
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) =>
          message.role === "system" ? (
            <p key={message.id} className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
              {message.content}
            </p>
          ) : (
            <div key={message.id} className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}>
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                {message.role === "user" ? <User className="size-4" aria-hidden /> : <Bot className="size-4" aria-hidden />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {message.content}
                {message.toolsUsed && message.toolsUsed.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Tools used: {message.toolsUsed.join(", ")}</p>
                )}
              </div>
            </div>
          )
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Analyzing factory data…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t p-3">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Message"
        />
        <Button type="submit" disabled={disabled || loading || !draft.trim()} aria-label="Send message">
          <Send />
        </Button>
      </form>
      {footerNote && <div className="border-t px-4 py-2 text-xs text-muted-foreground">{footerNote}</div>}
    </div>
  )
}
