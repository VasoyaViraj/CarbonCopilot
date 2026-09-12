import { useState } from "react"
import { CircleAlert, CircleCheck, Download, RotateCcw, Upload } from "lucide-react"
import DataTable, { type Column } from "@/components/DataTable"
import FileUploader from "@/components/FileUploader"
import { Button } from "@/components/ui/button"
import { getApiErrorMessage } from "@/services/apiClient"
import {
  activityService,
  getCsvRowErrors,
  type ActivityCatalog,
  type CsvImportSummary,
  type CsvPreviewRow,
  type CsvRowError,
} from "@/services/activityService"
import { formatActivityDate, formatNumber } from "@/utils/format"

// DATA_INPUT → VALIDATING → (VALIDATION_ERROR | ready to import) → INGESTED (docs/STATE_MACHINES.md §3)
type Phase =
  | { name: "idle" }
  | { name: "validating"; file: File; progress: number }
  | { name: "validated"; file: File; summary: CsvImportSummary }
  | { name: "importing"; file: File; summary: CsvImportSummary; progress: number }
  | { name: "imported"; summary: CsvImportSummary }
  | { name: "failed"; message: string; errors: CsvRowError[] }

type CsvImportPanelProps = {
  factoryId: number
  catalog: ActivityCatalog
  readOnly: boolean
  onImported: () => void
}

const errorColumns: Column<CsvRowError & { key: string }>[] = [
  { key: "row", header: "Row", render: (error) => (error.row > 0 ? error.row : "File") },
  { key: "field", header: "Column", render: (error) => <code className="text-xs">{error.field}</code> },
  { key: "message", header: "Problem", render: (error) => error.message },
]

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-heading text-xl font-semibold tabular-nums ${tone === "bad" && value > 0 ? "text-destructive" : ""}`}>
        {formatNumber(value)}
      </p>
    </div>
  )
}

function UploadProgress({ label, progress }: { label: string; progress: number }) {
  const uploading = progress < 100
  return (
    <div className="flex flex-col gap-1.5" role="status">
      <div className="flex justify-between text-sm">
        <span>{uploading ? `Uploading ${label}…` : "Validating rows…"}</span>
        {uploading && <span className="tabular-nums text-muted-foreground">{progress}%</span>}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div className={`h-full bg-primary transition-all ${uploading ? "" : "animate-pulse"}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function RowErrors({ errors, truncated }: { errors: CsvRowError[]; truncated?: boolean }) {
  if (errors.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">Row-level errors</h4>
      <DataTable
        columns={errorColumns}
        rows={errors.map((error, index) => ({ ...error, key: `${error.row}-${error.field}-${index}` }))}
        getRowKey={(error) => error.key}
        caption="CSV validation errors"
      />
      {truncated && <p className="text-xs text-muted-foreground">Only the first {errors.length} errors are shown.</p>}
    </div>
  )
}

function Preview({ rows, catalog }: { rows: CsvPreviewRow[]; catalog: ActivityCatalog }) {
  if (rows.length === 0) return null
  const label = (key: string) => catalog.types.find((type) => type.key === key)?.label ?? key
  const columns: Column<CsvPreviewRow & { key: string }>[] = [
    { key: "row", header: "Row", render: (row) => row.row },
    { key: "date", header: "Date", render: (row) => formatActivityDate(row.activityDate) },
    { key: "process", header: "Process", render: (row) => row.processName },
    { key: "type", header: "Activity", render: (row) => label(row.energyType) },
    { key: "quantity", header: "Quantity", align: "right", render: (row) => `${formatNumber(row.quantity)} ${row.unit}` },
    {
      key: "production",
      header: "Production",
      align: "right",
      render: (row) => (row.productionQuantity == null ? "—" : `${formatNumber(row.productionQuantity)} ${row.productionUnit}`),
    },
  ]
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">How the first valid rows will be recorded</h4>
      <DataTable
        columns={columns}
        rows={rows.map((row, index) => ({ ...row, key: `${row.row}-${index}` }))}
        getRowKey={(row) => row.key}
        caption="Preview of activities to import"
      />
    </div>
  )
}

export default function CsvImportPanel({ factoryId, catalog, readOnly, onImported }: CsvImportPanelProps) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" })
  const [uploaderKey, setUploaderKey] = useState(0)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const busy = phase.name === "validating" || phase.name === "importing"

  function reset() {
    setPhase({ name: "idle" })
    setUploaderKey((key) => key + 1)
  }

  function fail(error: unknown, fallback: string) {
    setPhase({ name: "failed", message: getApiErrorMessage(error, fallback), errors: getCsvRowErrors(error) })
  }

  async function validate(file: File) {
    setPhase({ name: "validating", file, progress: 0 })
    try {
      const summary = await activityService.uploadCsv(factoryId, file, {
        dryRun: true,
        onProgress: (progress) => setPhase({ name: "validating", file, progress }),
      })
      setPhase({ name: "validated", file, summary })
    } catch (error) {
      fail(error, "The file could not be validated.")
    }
  }

  async function importRows(file: File, validated: CsvImportSummary) {
    setPhase({ name: "importing", file, summary: validated, progress: 0 })
    try {
      const summary = await activityService.uploadCsv(factoryId, file, {
        // Invalid rows were shown to the user and they chose to import the rest; the server re-validates everything.
        skipInvalidRows: validated.invalidRows > 0,
        onProgress: (progress) => setPhase({ name: "importing", file, summary: validated, progress }),
      })
      setPhase({ name: "imported", summary })
      onImported()
    } catch (error) {
      fail(error, "The file could not be imported.")
    }
  }

  async function downloadTemplate() {
    setTemplateError(null)
    try {
      const blob = await activityService.downloadTemplate()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "ecotrace-activities-template.csv"
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setTemplateError(getApiErrorMessage(error, "The template could not be downloaded."))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1 text-sm text-muted-foreground">
          <p>
            Required columns:{" "}
            <code className="rounded bg-muted px-1">{catalog.csv.requiredColumns.join(", ")}</code>
          </p>
          <p>
            Each filled energy, fuel, material or waste cell becomes one activity. Add <code>fuel_type</code>,{" "}
            <code>material_type</code> and <code>waste_type</code> for those columns; energy defaults to electricity. Rows with any
            error are never imported, and rows already imported are rejected as duplicates.
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer text-foreground">Supported activity types and units</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {catalog.types.map((type) => (
                <li key={type.key}>
                  <code>{type.key}</code> — {type.unit} <span className="text-xs">({type.category.toLowerCase()})</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download /> Download template
          </Button>
          {templateError && (
            <p role="alert" className="text-xs text-destructive">
              {templateError}
            </p>
          )}
        </div>
      </div>

      {(phase.name === "idle" || phase.name === "failed") && (
        <FileUploader
          key={uploaderKey}
          accept=".csv"
          maxSizeMb={catalog.csv.maxFileSizeMb}
          disabled={readOnly}
          description={`.csv up to ${catalog.csv.maxFileSizeMb} MB and ${formatNumber(catalog.csv.maxRows)} rows — validated before anything is saved`}
          onFileSelected={validate}
        />
      )}

      {busy && <UploadProgress label={phase.file.name} progress={phase.progress} />}

      {phase.name === "failed" && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <CircleAlert className="size-4" aria-hidden /> {phase.message}
          </p>
          <RowErrors errors={phase.errors} />
        </div>
      )}

      {phase.name === "validated" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Validated <span className="font-medium">{phase.file.name}</span>. Nothing has been saved yet.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Rows in file" value={phase.summary.totalRows} />
            <StatTile label="Valid rows" value={phase.summary.validRows} />
            <StatTile label="Rows with errors" value={phase.summary.invalidRows} tone="bad" />
            <StatTile label="Activities to create" value={phase.summary.activityCount} />
          </div>
          {phase.summary.invalidRows > 0 && (
            <p className="flex items-start gap-1.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {phase.summary.validRows > 0
                ? `${phase.summary.invalidRows} row(s) have errors and will be skipped. Fix and re-upload them later, or correct the file now.`
                : "No row can be imported. Fix the errors below and upload the file again."}
            </p>
          )}
          <RowErrors errors={phase.summary.errors} truncated={phase.summary.errorsTruncated} />
          <Preview rows={phase.summary.preview} catalog={catalog} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={readOnly || phase.summary.validRows === 0} onClick={() => importRows(phase.file, phase.summary)}>
              <Upload />
              {phase.summary.invalidRows > 0
                ? `Import ${phase.summary.validRows} valid row(s), skip ${phase.summary.invalidRows}`
                : `Import ${phase.summary.validRows} row(s)`}
            </Button>
            <Button variant="outline" onClick={reset}>
              <RotateCcw /> Choose another file
            </Button>
          </div>
        </div>
      )}

      {phase.name === "imported" && (
        <div className="flex flex-col gap-4">
          <p role="status" className="flex items-center gap-1.5 text-sm">
            <CircleCheck className="size-4 text-primary" aria-hidden />
            Imported {formatNumber(phase.summary.validRows)} row(s) from {phase.summary.fileName} as{" "}
            {formatNumber(phase.summary.activityCount)} activities.
            {phase.summary.invalidRows > 0 && ` ${phase.summary.invalidRows} row(s) with errors were not imported.`}
          </p>
          <RowErrors errors={phase.summary.errors} truncated={phase.summary.errorsTruncated} />
          <Button variant="outline" className="w-fit" onClick={reset}>
            <RotateCcw /> Upload another file
          </Button>
        </div>
      )}
    </div>
  )
}
