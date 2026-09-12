import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type Column<T> = {
  key: string
  header: string
  align?: "left" | "right"
  render: (row: T) => ReactNode
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string | number
  caption?: string
  emptyMessage?: string
}

export default function DataTable<T>({ columns, rows, getRowKey, caption, emptyMessage = "No records yet." }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn("px-4 py-2.5 font-medium", col.align === "right" ? "text-right" : "text-left")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-2.5", col.align === "right" ? "text-right tabular-nums" : "text-left")}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
