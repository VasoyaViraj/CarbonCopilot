import { apiClient, type ApiSuccess } from "@/services/apiClient"

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
}
