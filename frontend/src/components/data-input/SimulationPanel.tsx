import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { FlaskConical, Play, Square, Zap } from "lucide-react"
import DataTable, { type Column } from "@/components/DataTable"
import FormField from "@/components/forms/FormField"
import ActivitySourceBadge from "@/components/data-input/ActivitySourceBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, Select } from "@/components/ui/input"
import { getApiErrorMessage } from "@/services/apiClient"
import { activityService, type ActivityCatalog, type ActivityType } from "@/services/activityService"
import type { Process } from "@/services/factoryService"
import { formatActivityDate, formatNumber } from "@/utils/format"

const INTERVALS = [2, 5, 10, 30]
const MAX_READINGS_LIMIT = 100
const VISIBLE_READINGS = 20

type Config = {
  processId: string
  energyType: string
  baseline: string
  variability: number
  spikeChance: number
  intervalSeconds: number
  maxReadings: string
}

type Reading = {
  activityId: number
  at: string
  processName: string
  typeLabel: string
  quantity: number
  unit: string
  spike: boolean
}

type Settings = {
  process: Process
  type: ActivityType
  baseline: number
  variability: number
  spikeChance: number
  intervalSeconds: number
  maxReadings: number
}

type SimulationPanelProps = {
  processes: Process[]
  catalog: ActivityCatalog
  readOnly: boolean
  onReading: () => void
}

function parseSettings(config: Config, processes: Process[], types: ActivityType[]): Settings | string {
  const process = processes.find((candidate) => String(candidate.id) === config.processId)
  const type = types.find((candidate) => candidate.key === config.energyType)
  const baseline = Number(config.baseline)
  const maxReadings = Number(config.maxReadings)
  if (!process) return "Select a process to simulate."
  if (!type) return "Select a reading stream."
  if (!Number.isFinite(baseline) || baseline <= 0) return "Baseline per reading must be greater than 0."
  // Worst case: +variability and a 2× spike — must still be a plausible record for the API.
  if (baseline * (1 + config.variability / 100) * 2 > type.maxQuantity) {
    return `Baseline is too high for ${type.label} (limit ${formatNumber(type.maxQuantity)} ${type.unit} per reading).`
  }
  if (!Number.isInteger(maxReadings) || maxReadings < 1 || maxReadings > MAX_READINGS_LIMIT) {
    return `Readings per run must be a whole number from 1 to ${MAX_READINGS_LIMIT}.`
  }
  return { process, type, baseline, variability: config.variability, spikeChance: config.spikeChance, intervalSeconds: config.intervalSeconds, maxReadings }
}

/** Synthetic value around the baseline; optionally an injected spike to exercise downstream analysis. */
function nextValue(settings: Settings) {
  const spike = Math.random() * 100 < settings.spikeChance
  const noise = 1 + ((Math.random() * 2 - 1) * settings.variability) / 100
  const quantity = Math.round(settings.baseline * noise * (spike ? 1.5 + Math.random() * 0.5 : 1) * 100) / 100
  return { quantity: Math.max(quantity, 0.01), spike }
}

/**
 * Browser-side stand-in for a sensor: each reading is posted through the same ingestion API as
 * manual data, with source SIMULATION, so it is stored and labelled as simulated end to end.
 */
export default function SimulationPanel({ processes, catalog, readOnly, onReading }: SimulationPanelProps) {
  const streamTypes = catalog.types.filter((type) => type.category === "ENERGY" || type.category === "FUEL")
  const [config, setConfig] = useState<Config>({
    processId: processes[0] ? String(processes[0].id) : "",
    energyType: streamTypes[0]?.key ?? "",
    baseline: "50",
    variability: 10,
    spikeChance: 0,
    intervalSeconds: 5,
    maxReadings: "20",
  })
  const [running, setRunning] = useState(false)
  const [sent, setSent] = useState(0)
  const [target, setTarget] = useState(0)
  const [readings, setReadings] = useState<Reading[]>([])
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null)
  // Incremented on every start/stop so a pending tick from an earlier run never schedules another.
  const runId = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const runs = runId
    const timeout = timer
    return () => {
      runs.current += 1
      window.clearTimeout(timeout.current)
    }
  }, [])

  const selectedType = streamTypes.find((type) => type.key === config.energyType)

  const update = (field: keyof Config) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { value, type } = event.target
    setConfig((current) => ({ ...current, [field]: type === "range" || field === "intervalSeconds" ? Number(value) : value }))
  }

  function stop(next?: { tone: "info" | "error"; text: string }) {
    runId.current += 1
    window.clearTimeout(timer.current)
    setRunning(false)
    if (next) setMessage(next)
  }

  function start() {
    const settings = parseSettings(config, processes, streamTypes)
    if (typeof settings === "string") {
      setMessage({ tone: "error", text: settings })
      return
    }
    const id = ++runId.current
    let count = 0
    setRunning(true)
    setSent(0)
    setTarget(settings.maxReadings)
    setMessage(null)

    const tick = async () => {
      if (runId.current !== id) return
      const { quantity, spike } = nextValue(settings)
      try {
        const activity = await activityService.create(settings.process.id, {
          activityDate: new Date().toISOString(),
          energyType: settings.type.key,
          quantity,
          unit: settings.type.unit,
          source: "SIMULATION",
        })
        // A reading saved after Stop was pressed is still shown: it exists in the database.
        count += 1
        setReadings((current) =>
          [
            {
              activityId: activity.id,
              at: activity.activityDate,
              processName: settings.process.name,
              typeLabel: settings.type.label,
              quantity: activity.quantity,
              unit: activity.unit,
              spike,
            },
            ...current,
          ].slice(0, VISIBLE_READINGS)
        )
        onReading()
        if (runId.current !== id) return
        setSent(count)
        if (count >= settings.maxReadings) {
          stop({ tone: "info", text: `Run complete — ${count} simulated readings saved.` })
          return
        }
        timer.current = window.setTimeout(tick, settings.intervalSeconds * 1000)
      } catch (error) {
        if (runId.current === id) stop({ tone: "error", text: getApiErrorMessage(error, "The simulated reading could not be saved.") })
      }
    }
    tick()
  }

  const columns: Column<Reading>[] = [
    { key: "time", header: "Time", render: (row) => formatActivityDate(row.at) },
    { key: "process", header: "Process", render: (row) => row.processName },
    { key: "stream", header: "Stream", render: (row) => row.typeLabel },
    { key: "value", header: "Value", align: "right", render: (row) => `${formatNumber(row.quantity)} ${row.unit}` },
    {
      key: "label",
      header: "Label",
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          <ActivitySourceBadge source="SIMULATION" />
          {row.spike && (
            <Badge variant="outline" title="The simulator deliberately injected a spike into this reading">
              <Zap aria-hidden /> Injected spike
            </Badge>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">
            Simulated data <Badge className="ml-1">SIMULATED</Badge>
          </p>
          <p className="text-muted-foreground">
            Readings are synthetic values generated in your browser and saved as activities with source <code>SIMULATION</code>. They
            are not physical sensor measurements, and they are labelled as simulated wherever they appear.
          </p>
        </div>
      </div>

      <fieldset disabled={readOnly || running} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Simulator configuration</legend>
        <FormField label="Process" htmlFor="sim-process">
          <Select id="sim-process" value={config.processId} onChange={update("processId")}>
            {processes.map((process) => (
              <option key={process.id} value={process.id}>
                {process.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Reading stream" htmlFor="sim-type">
          <Select id="sim-type" value={config.energyType} onChange={update("energyType")}>
            {streamTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label} ({type.unit})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={`Baseline per reading${selectedType ? ` (${selectedType.unit})` : ""}`} htmlFor="sim-baseline">
          <Input id="sim-baseline" type="number" inputMode="decimal" min={0} step="any" value={config.baseline} onChange={update("baseline")} />
        </FormField>
        <FormField label={`Variability ±${config.variability}%`} htmlFor="sim-variability">
          <input
            id="sim-variability"
            type="range"
            min={0}
            max={50}
            step={1}
            value={config.variability}
            onChange={update("variability")}
            className="h-9 w-full accent-primary"
          />
        </FormField>
        <FormField label={`Spike chance ${config.spikeChance}%`} htmlFor="sim-spike" hint="Injects 1.5–2× readings to exercise hotspot and anomaly screens.">
          <input
            id="sim-spike"
            type="range"
            min={0}
            max={50}
            step={1}
            value={config.spikeChance}
            onChange={update("spikeChance")}
            className="h-9 w-full accent-primary"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Every" htmlFor="sim-interval">
            <Select id="sim-interval" value={config.intervalSeconds} onChange={update("intervalSeconds")}>
              {INTERVALS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} s
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Readings per run" htmlFor="sim-max">
            <Input id="sim-max" type="number" min={1} max={MAX_READINGS_LIMIT} step={1} value={config.maxReadings} onChange={update("maxReadings")} />
          </FormField>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={readOnly || running}>
          <Play /> Start
        </Button>
        <Button variant="outline" onClick={() => stop({ tone: "info", text: `Stopped — ${sent} simulated readings saved.` })} disabled={!running}>
          <Square /> Stop
        </Button>
        <span className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span className={`size-2 rounded-full ${running ? "animate-pulse bg-primary" : "bg-muted-foreground/40"}`} aria-hidden />
          {running ? `Running — ${sent} of ${target} readings sent (every ${config.intervalSeconds} s)` : "Stopped"}
        </span>
      </div>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-destructive" : ""}`}>
          {message.text}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={readings}
        getRowKey={(row) => row.activityId}
        caption="Simulated readings from this session"
        emptyMessage="No simulated readings yet — configure the stream and press Start."
      />
    </div>
  )
}
