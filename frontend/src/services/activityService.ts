import { isAxiosError } from "axios"
import { apiClient, type ApiErrorBody, type ApiSuccess } from "@/services/apiClient"

export type ActivitySource = "MANUAL" | "CSV" | "SIMULATION"
export type ActivityCategory = "ENERGY" | "FUEL" | "MATERIAL" | "WASTE"

export type ActivityType = {
  key: string
  category: ActivityCategory
  label: string
  /** Canonical unit of the emission factor this type maps to. */
  unit: string
  maxQuantity: number
}

export type ActivityCatalog = {
  categories: ActivityCategory[]
  types: ActivityType[]
  productionUnits: string[]
  defaultProductionUnit: string
  maxProductionQuantity: number
  sources: ActivitySource[]
  csv: { requiredColumns: string[]; optionalColumns: string[]; maxRows: number; maxFileSizeMb: number }
}

/** `row` is the spreadsheet line number (0 for file-level problems). */
export type CsvRowError = { row: number; field: string; message: string }

export type CsvPreviewRow = {
  row: number
  processName: string
  activityDate: string
  energyType: string
  quantity: number
  unit: string
  productionQuantity: number | null
  productionUnit: string | null
}

export type CsvImportSummary = {
  fileName: string
  dryRun: boolean
  imported: boolean
  totalRows: number
  validRows: number
  invalidRows: number
  activityCount: number
  errors: CsvRowError[]
  errorsTruncated: boolean
  preview: CsvPreviewRow[]
}

export type UploadCsvOptions = {
  /** Validate only; nothing is written. */
  dryRun?: boolean
  /** Import the valid rows even if some rows are invalid (otherwise nothing is imported). */
  skipInvalidRows?: boolean
  onProgress?: (percent: number) => void
}

/** Row-level errors carried in a rejected upload's error details. */
export function getCsvRowErrors(error: unknown): CsvRowError[] {
  if (!isAxiosError<ApiErrorBody>(error)) return []
  const details: { field: string; message: string; row?: number }[] = error.response?.data?.error?.details ?? []
  return details.map((detail) => ({ row: detail.row ?? 0, field: detail.field, message: detail.message }))
}

export type Activity = {
  id: number
  processId: number
  processName: string | null
  activityDate: string
  energyType: string
  category: ActivityCategory | null
  quantity: number
  unit: string
  productionQuantity: number | null
  productionUnit: string | null
  source: ActivitySource
  /** Always true for SIMULATION activities — never physical sensor measurements. */
  isSimulated: boolean
  createdAt: string
}

export type ActivityPage = { items: Activity[]; total: number; limit: number; offset: number }

export type CreateActivityInput = {
  activityDate: string
  energyType: string
  quantity: number
  unit?: string
  productionQuantity?: number
  productionUnit?: string
  source?: Extract<ActivitySource, "MANUAL" | "SIMULATION">
}

export type ActivityListQuery = {
  source?: ActivitySource
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export const activityService = {
  async getCatalog(): Promise<ActivityCatalog> {
    const res = await apiClient.get<ApiSuccess<ActivityCatalog>>("/activities/types")
    return res.data.data
  },

  async create(processId: number, input: CreateActivityInput): Promise<Activity> {
    const res = await apiClient.post<ApiSuccess<Activity>>(`/processes/${processId}/activities`, input)
    return res.data.data
  },

  async listForFactory(factoryId: number, query: ActivityListQuery = {}): Promise<ActivityPage> {
    const res = await apiClient.get<ApiSuccess<ActivityPage>>(`/factories/${factoryId}/activities`, { params: query })
    return res.data.data
  },

  async uploadCsv(factoryId: number, file: File, { dryRun = false, skipInvalidRows = false, onProgress }: UploadCsvOptions = {}) {
    const form = new FormData()
    form.append("factoryId", String(factoryId))
    form.append("dryRun", String(dryRun))
    form.append("skipInvalidRows", String(skipInvalidRows))
    form.append("file", file)
    // The browser sets the multipart boundary for FormData bodies.
    const res = await apiClient.post<ApiSuccess<CsvImportSummary>>("/activities/upload", form, {
      timeout: 120_000,
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    })
    return res.data.data
  },

  async downloadTemplate(): Promise<Blob> {
    const res = await apiClient.get<Blob>("/activities/template", { responseType: "blob" })
    return res.data
  },
}
