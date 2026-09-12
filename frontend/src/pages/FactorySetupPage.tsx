import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { CheckCircle2, Factory as FactoryIcon, Lock, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FactorySelect from "@/components/FactorySelect"
import FormField from "@/components/forms/FormField"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { useFactorySelection } from "@/hooks/useFactorySelection"
import { useLatestRequest } from "@/hooks/useLatestRequest"
import { getApiErrorMessage, getApiFieldErrors } from "@/services/apiClient"
import { factoryService, type Factory, type FactoryInput, type Process, type ProcessInput } from "@/services/factoryService"
import { FACTORY_MANAGERS, ROLE_LABELS } from "@/utils/roles"

type Notice = { kind: "success" | "error"; message: string } | null

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <Alert variant={notice.kind === "error" ? "destructive" : "default"} className="mb-4">
      {notice.kind === "error" ? <TriangleAlert /> : <CheckCircle2 />}
      <AlertDescription>{notice.message}</AlertDescription>
    </Alert>
  )
}

const optional = (value: string) => value.trim() || undefined

type ProfileFormProps = {
  factory: Factory | null
  canManage: boolean
  onSaved: (factory: Factory, created: boolean) => Promise<void>
  onError: (message: string) => void
  onCancel?: () => void
}

/** Factory profile form; remounted (keyed) per factory so it always starts from the saved values. */
function FactoryProfileForm({ factory, canManage, onSaved, onError, onCancel }: ProfileFormProps) {
  const [form, setForm] = useState({
    name: factory?.name ?? "",
    industryType: factory?.industry_type ?? "",
    location: factory?.location ?? "",
    productionCapacity: factory?.production_capacity?.toString() ?? "",
    productionUnit: factory?.production_unit ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const bind = (key: keyof typeof form) => ({
    value: form[key],
    disabled: !canManage || saving,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: event.target.value })),
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    const payload: FactoryInput = {
      name: form.name.trim(),
      industryType: optional(form.industryType),
      location: optional(form.location),
      productionCapacity: form.productionCapacity === "" ? undefined : Number(form.productionCapacity),
      productionUnit: optional(form.productionUnit),
    }
    try {
      const { data } = factory ? await factoryService.updateFactory(factory.id, payload) : await factoryService.createFactory(payload)
      await onSaved(data, !factory)
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err))
      onError(getApiErrorMessage(err, "The factory could not be saved."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
      <div className="sm:col-span-2">
        <FormField label="Factory name" htmlFor="factory-name" error={fieldErrors.name}>
          <Input id="factory-name" placeholder="ABC Metal Manufacturing" required maxLength={120} {...bind("name")} />
        </FormField>
      </div>
      <FormField label="Industry" htmlFor="factory-industry" error={fieldErrors.industryType}>
        <Input id="factory-industry" placeholder="Metal Components" {...bind("industryType")} />
      </FormField>
      <FormField label="Location" htmlFor="factory-location" error={fieldErrors.location}>
        <Input id="factory-location" {...bind("location")} />
      </FormField>
      <FormField label="Production capacity" htmlFor="factory-capacity" error={fieldErrors.productionCapacity}>
        <Input id="factory-capacity" type="number" min={0} step="any" {...bind("productionCapacity")} />
      </FormField>
      <FormField label="Production unit" htmlFor="factory-unit" error={fieldErrors.productionUnit}>
        <Input id="factory-unit" placeholder="tonnes/year" {...bind("productionUnit")} />
      </FormField>
      {canManage && (
        <div className="mt-2 flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : factory ? "Save factory" : "Create factory"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </form>
  )
}

type ProcessesPanelProps = {
  factory: Factory
  canManage: boolean
  processes: Process[] | null
  error: string | null
  onReload: () => Promise<void>
  onNotice: (notice: Notice) => void
}

const EMPTY_PROCESS = { name: "", processType: "", description: "" }

function ProcessesPanel({ factory, canManage, processes, error, onReload, onNotice }: ProcessesPanelProps) {
  const [editing, setEditing] = useState<Process | "new" | null>(null)
  const [form, setForm] = useState(EMPTY_PROCESS)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const open = (process?: Process) => {
    setEditing(process ?? "new")
    setFieldErrors({})
    setForm(
      process ? { name: process.name, processType: process.process_type ?? "", description: process.description ?? "" } : EMPTY_PROCESS
    )
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setFieldErrors({})
    const payload: ProcessInput = { name: form.name.trim(), processType: optional(form.processType), description: optional(form.description) }
    try {
      if (editing && editing !== "new") await factoryService.updateProcess(factory.id, editing.id, payload)
      else await factoryService.createProcess(factory.id, payload)
      await onReload()
      onNotice({ kind: "success", message: `Process “${payload.name}” saved.` })
      setEditing(null)
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err))
      onNotice({ kind: "error", message: getApiErrorMessage(err, "The process could not be saved.") })
    } finally {
      setBusy(false)
    }
  }

  async function remove(process: Process) {
    if (!window.confirm(`Delete the process “${process.name}”?`)) return
    setBusy(true)
    try {
      await factoryService.deleteProcess(factory.id, process.id)
      await onReload()
      onNotice({ kind: "success", message: `Process “${process.name}” deleted.` })
    } catch (err) {
      onNotice({ kind: "error", message: getApiErrorMessage(err, "The process could not be deleted.") })
    } finally {
      setBusy(false)
    }
  }

  let list
  if (!processes) {
    list = error ? <ErrorState title="Processes are unavailable" message={error} onRetry={() => void onReload()} /> : <LoadingState label="Loading processes…" />
  } else if (processes.length === 0) {
    list = (
      <EmptyState
        icon={FactoryIcon}
        title="No processes yet"
        description={canManage ? "Add the processes that make up your factory to start recording activity data." : "No processes have been configured for this factory."}
      />
    )
  } else {
    list = (
      <ul className="flex flex-col gap-3">
        {processes.map((process) => (
          <li key={process.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">{process.name}</div>
              <div className="text-sm text-muted-foreground">{process.process_type || "No type"}</div>
            </div>
            {canManage && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => open(process)} disabled={busy} aria-label={`Edit ${process.name}`}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(process)}
                  disabled={busy}
                  className="text-destructive"
                  aria-label={`Delete ${process.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Processes</CardTitle>
          <CardDescription>Furnace, boiler, assembly, transport…</CardDescription>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => open()} disabled={editing !== null || busy}>
            <Plus className="size-4" /> Add process
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing !== null ? (
          <form className="grid gap-4 rounded-md border bg-muted/30 p-4" onSubmit={save} noValidate>
            <h3 className="font-medium">{editing === "new" ? "New process" : `Edit ${editing.name}`}</h3>
            <FormField label="Process name" htmlFor="process-name" error={fieldErrors.name}>
              <Input
                id="process-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                disabled={busy}
                required
              />
            </FormField>
            <FormField label="Process type" htmlFor="process-type" error={fieldErrors.processType}>
              <Input
                id="process-type"
                placeholder="e.g. THERMAL, ELECTRICAL"
                value={form.processType}
                onChange={(event) => setForm({ ...form, processType: event.target.value })}
                disabled={busy}
              />
            </FormField>
            <FormField label="Description" htmlFor="process-desc" error={fieldErrors.description}>
              <Input
                id="process-desc"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                disabled={busy}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !form.name.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          list
        )}
      </CardContent>
    </Card>
  )
}

export default function FactorySetupPage() {
  const { user } = useAuth()
  const canManage = !!user && FACTORY_MANAGERS.includes(user.role)
  const { status, error, factories, factory, selectFactory, reload } = useFactorySelection()
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const editing = creating ? null : factory
  const editingId = editing?.id ?? null
  const processesFetcher = useMemo(
    () => (editingId == null ? null : async () => ({ factoryId: editingId, items: (await factoryService.getProcesses(editingId)).data })),
    [editingId]
  )
  const processes = useLatestRequest(processesFetcher, "Processes could not be loaded.")
  const processList = processes.data && processes.data.factoryId === editingId ? processes.data.items : null

  const changeFactory = (id: number) => {
    setNotice(null)
    selectFactory(id)
  }

  const startCreating = () => {
    setNotice(null)
    setCreating(true)
  }

  const handleSaved = async (saved: Factory, created: boolean) => {
    setNotice({ kind: "success", message: created ? `Created ${saved.name}. Add its processes next.` : "Factory profile saved." })
    setCreating(false)
    await reload()
    selectFactory(saved.id)
  }

  const showError = (message: string) => setNotice({ kind: "error", message })

  let content
  if (status === "loading") {
    content = <LoadingState label="Loading factories…" />
  } else if (status === "error") {
    content = <ErrorState message={error ?? undefined} onRetry={reload} />
  } else if (!editing && !canManage) {
    content = (
      <Card>
        <EmptyState
          icon={FactoryIcon}
          title="No factories yet"
          description="An admin or factory operator in your organization needs to set up a factory first."
        />
      </Card>
    )
  } else {
    content = (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{editing ? "Factory profile" : "New factory"}</CardTitle>
              <CardDescription>Used to normalise emission intensity.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <FactoryProfileForm
              key={editing?.id ?? "new"}
              factory={editing}
              canManage={canManage}
              onSaved={handleSaved}
              onError={showError}
              onCancel={creating && factory ? () => setCreating(false) : undefined}
            />
          </CardContent>
        </Card>
        {editing ? (
          <ProcessesPanel
            key={editing.id}
            factory={editing}
            canManage={canManage}
            processes={processList}
            error={processes.error}
            onReload={processes.reload}
            onNotice={setNotice}
          />
        ) : (
          <Card>
            <EmptyState icon={FactoryIcon} title="Save the factory first" description="Processes are added once the factory profile exists." />
          </Card>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Factory Setup"
        description="Describe your site and the processes that consume energy, fuel and materials."
        actions={
          status === "ready" && (
            <>
              {factory && !creating && <FactorySelect factories={factories} value={factory.id} onChange={changeFactory} />}
              {canManage && factory && !creating && (
                <Button variant="outline" size="sm" onClick={startCreating}>
                  <Plus className="size-4" /> New factory
                </Button>
              )}
            </>
          )
        }
      />
      {!canManage && user && status === "ready" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Your role ({ROLE_LABELS[user.role]}) can view factory configuration. Admins and factory operators can change it.
          </span>
        </div>
      )}
      <NoticeBanner notice={notice} />
      {content}
    </>
  )
}
