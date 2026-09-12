import { Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; text: string }

// **bold**, _emphasis_ (not inside snake_case words) and `code`.
const INLINE = /(\*\*[^*]+\*\*|(?<![\w])_[^_\n]+_(?![\w])|`[^`\n]+`)/g

function renderInline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, index) => {
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>
      if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={index}>{part.slice(1, -1)}</em>
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="rounded bg-background/60 px-1 text-xs">
            {part.slice(1, -1)}
          </code>
        )
      }
      return <Fragment key={index}>{part}</Fragment>
    })
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") })
    paragraph = []
  }

  for (const raw of source.split("\n")) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] })
      continue
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    const item = bullet?.[1] ?? numbered?.[1]
    if (item !== undefined) {
      flush()
      const ordered = !bullet
      const last = blocks[blocks.length - 1]
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(item)
      else blocks.push({ kind: "list", ordered, items: [item] })
      continue
    }
    paragraph.push(line)
  }
  flush()
  return blocks
}

/** Renders the small Markdown subset copilot answers use, as React elements (no raw HTML). */
export default function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 text-sm leading-relaxed", className)}>
      {parseBlocks(text).map((block, index) => {
        if (block.kind === "heading") {
          return block.level <= 2 ? (
            <h3 key={index} className="font-heading text-base font-semibold">
              {renderInline(block.text)}
            </h3>
          ) : (
            <h4 key={index} className="mt-1 font-semibold">
              {renderInline(block.text)}
            </h4>
          )
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul"
          return (
            <List key={index} className={cn("flex flex-col gap-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </List>
          )
        }
        return <p key={index}>{renderInline(block.text)}</p>
      })}
    </div>
  )
}
