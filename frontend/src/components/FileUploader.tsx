import { useId, useState, type ChangeEvent, type DragEvent } from "react"
import { FileSpreadsheet, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

type FileUploaderProps = {
  /** Comma-separated extensions, e.g. ".csv". */
  accept?: string
  maxSizeMb?: number
  disabled?: boolean
  description?: string
  onFileSelected: (file: File) => void
}

export default function FileUploader({
  accept = ".csv",
  maxSizeMb = 5,
  disabled = false,
  description,
  onFileSelected,
}: FileUploaderProps) {
  const inputId = useId()
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allowed = accept.split(",").map((ext) => ext.trim().toLowerCase())

  function handleFile(file: File | undefined) {
    if (!file) return
    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`
    if (!allowed.includes(extension)) {
      setError(`Unsupported file type. Allowed: ${allowed.join(", ")}`)
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is larger than ${maxSizeMb} MB.`)
      return
    }
    setError(null)
    setFileName(file.name)
    onFileSelected(file)
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragOver(false)
    if (!disabled) handleFile(event.dataTransfer.files[0])
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0])
    event.target.value = ""
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">Drag and drop a file, or click to browse</span>
        <span className="text-xs text-muted-foreground">
          {description ?? `${allowed.join(", ")} up to ${maxSizeMb} MB`}
        </span>
        <input id={inputId} type="file" accept={accept} disabled={disabled} onChange={onChange} className="sr-only" />
      </label>
      {fileName && !error && (
        <p className="flex items-center gap-1.5 text-sm">
          <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden /> {fileName}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
