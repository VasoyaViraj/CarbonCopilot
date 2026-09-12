import { useState, type ChangeEvent, type FormEvent } from "react"
import { CircleCheck } from "lucide-react"
import FormField from "@/components/forms/FormField"
import { Button } from "@/components/ui/button"
import { Input, Select } from "@/components/ui/input"
import { getApiErrorMessage, getApiFieldErrors } from "@/services/apiClient"
import {
  activityService,
  type Activity,
  type ActivityCatalog,
  type ActivityCategory,
  type ActivityType,
} from "@/services/activityService"
import type { Process } from "@/services/factoryService"
import { formatNumber, toIsoDate } from "@/utils/format"

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  ENERGY: "Energy",
  FUEL: "Fuel",
  MATERIAL: "Material",
  WASTE: "Waste",
}

type FormState = {
  processId: string
  activityDate: string
  energyType: string
  quantity: string
  productionQuantity: string
  productionUnit: string
}

type ManualActivityFormProps = {
  processes: Process[]
  catalog: ActivityCatalog
  readOnly: boolean
  onCreated: (activity: Activity) => void
}

// Instant feedback only — the API re-validates every rule and its errors are shown per field.
function validate(form: FormState, type: ActivityType | undefined, catalog: ActivityCatalog) {
  const errors: Record<string, string> = {}
  if (!form.processId) errors.processId = "Select a process"
  if (!form.activityDate) errors.activityDate = "Enter the activity date"
  else if (form.activityDate > toIsoDate()) errors.activityDate = "Must not be in the future"
  if (!type) errors.energyType = "Select what was consumed"

  const quantity = Number(form.quantity)
  if (form.quantity.trim() === "") errors.quantity = "Enter a quantity"
  else if (!Number.isFinite(quantity) || quantity <= 0) errors.quantity = "Must be greater than 0"
  else if (type && quantity > type.maxQuantity) {
    errors.quantity = `Exceeds the plausible maximum of ${formatNumber(type.maxQuantity)} ${type.unit} — check the unit`
  }

  if (form.productionQuantity.trim() !== "") {
    const production = Number(form.productionQuantity)
    if (!Number.isFinite(production) || production < 0) errors.productionQuantity = "Must be 0 or more"
    else if (production > catalog.maxProductionQuantity) errors.productionQuantity = "Exceeds the plausible maximum"
  }
  return errors
}

export default function ManualActivityForm({ processes, catalog, readOnly, onCreated }: ManualActivityFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    processId: processes.length === 1 ? String(processes[0].id) : "",
    activityDate: toIsoDate(),
    energyType: "",
    quantity: "",
    productionQuantity: "",
    productionUnit: catalog.defaultProductionUnit,
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Activity | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const type = catalog.types.find((candidate) => candidate.key === form.energyType)

  const update = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(null)
    setFormError(null)
    const clientErrors = validate(form, type, catalog)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0 || !type) return

    setSubmitting(true)
    try {
      const hasProduction = form.productionQuantity.trim() !== ""
      const activity = await activityService.create(Number(form.processId), {
        activityDate: form.activityDate,
        energyType: type.key,
        quantity: Number(form.quantity),
        unit: type.unit,
        ...(hasProduction && { productionQuantity: Number(form.productionQuantity), productionUnit: form.productionUnit }),
        source: "MANUAL",
      })
      setSaved(activity)
      setForm((current) => ({ ...current, quantity: "", productionQuantity: "" }))
      onCreated(activity)
    } catch (error) {
      setErrors(getApiFieldErrors(error))
      setFormError(getApiErrorMessage(error, "The activity could not be saved."))
    } finally {
      setSubmitting(false)
    }
  }

  const savedType = saved && catalog.types.find((candidate) => candidate.key === saved.energyType)

  return (
    <form onSubmit={handleSubmit} noValidate>
      <fieldset disabled={readOnly || submitting} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Manual activity</legend>
        <FormField label="Process" htmlFor="activity-process" error={errors.processId}>
          <Select id="activity-process" value={form.processId} onChange={update("processId")} aria-invalid={!!errors.processId}>
            <option value="">Select process</option>
            {processes.map((process) => (
              <option key={process.id} value={process.id}>
                {process.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Activity date" htmlFor="activity-date" error={errors.activityDate}>
          <Input
            id="activity-date"
            type="date"
            max={toIsoDate()}
            value={form.activityDate}
            onChange={update("activityDate")}
            aria-invalid={!!errors.activityDate}
          />
        </FormField>
        <FormField label="Energy / fuel / material" htmlFor="activity-type" error={errors.energyType}>
          <Select id="activity-type" value={form.energyType} onChange={update("energyType")} aria-invalid={!!errors.energyType}>
            <option value="">Select type</option>
            {catalog.categories.map((category) => (
              <optgroup key={category} label={CATEGORY_LABELS[category]}>
                {catalog.types
                  .filter((candidate) => candidate.category === category)
                  .map((candidate) => (
                    <option key={candidate.key} value={candidate.key}>
                      {candidate.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </FormField>
        <FormField label="Quantity" htmlFor="activity-quantity" error={errors.quantity}>
          <Input
            id="activity-quantity"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="300"
            value={form.quantity}
            onChange={update("quantity")}
            aria-invalid={!!errors.quantity}
          />
        </FormField>
        <FormField label="Unit" htmlFor="activity-unit" error={errors.unit} hint="Fixed by the activity type so it matches its emission factor.">
          <Input id="activity-unit" readOnly value={type?.unit ?? ""} placeholder="Select a type first" />
        </FormField>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <FormField label="Production (optional)" htmlFor="activity-production" error={errors.productionQuantity}>
            <Input
              id="activity-production"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="8"
              value={form.productionQuantity}
              onChange={update("productionQuantity")}
              aria-invalid={!!errors.productionQuantity}
            />
          </FormField>
          <FormField label="Unit" htmlFor="activity-production-unit" error={errors.productionUnit}>
            <Select id="activity-production-unit" value={form.productionUnit} onChange={update("productionUnit")}>
              {catalog.productionUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
          <p className="text-xs text-muted-foreground">
            Record production once per process and day — enter it with only one of that day's activities so it is not counted twice.
          </p>
          <Button type="submit" className="w-fit" disabled={readOnly || submitting}>
            {submitting ? "Saving…" : "Save activity"}
          </Button>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          {saved && (
            <p role="status" className="flex items-center gap-1.5 text-sm">
              <CircleCheck className="size-4 text-primary" aria-hidden />
              Saved {savedType?.label ?? saved.energyType} · {formatNumber(saved.quantity)} {saved.unit} for {saved.processName}
              {saved.emission && ` → ${formatNumber(saved.emission.co2eValue)} ${saved.emission.co2eUnit} estimated`}.
            </p>
          )}
        </div>
      </fieldset>
    </form>
  )
}
