import { useCallback, useState } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon, Lock, Play, Square } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FileUploader from "@/components/FileUploader"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import NotConnectedNotice from "@/components/feedback/NotConnectedNotice"
import ManualActivityForm from "@/components/data-input/ManualActivityForm"
import RecentActivitiesTable from "@/components/data-input/RecentActivitiesTable"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/input"
import { Tabs } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { useDataInputContext } from "@/hooks/useDataInputContext"
import { OPERATIONAL_DATA_WRITERS, ROLE_LABELS } from "@/utils/roles"

const TABS = [
  { id: "manual", label: "Manual Input" },
  { id: "csv", label: "CSV Upload" },
  { id: "simulation", label: "Simulation" },
]

function CsvPanel() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Required columns: <code className="rounded bg-muted px-1">date, process, energy, fuel, material, production, waste</code>
      </p>
      <FileUploader accept=".csv" maxSizeMb={5} onFileSelected={() => undefined} />
      <NotConnectedNotice>CSV validation and import are not connected yet.</NotConnectedNotice>
    </div>
  )
}

function SimulationPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">SIMULATED</Badge>
        <p className="text-sm text-muted-foreground">
          Simulated readings are synthetic and are always labelled as simulated — they are not physical sensor measurements.
        </p>
      </div>
      <div className="flex gap-2">
        <Button disabled>
          <Play /> Start
        </Button>
        <Button variant="outline" disabled>
          <Square /> Stop
        </Button>
      </div>
      <NotConnectedNotice>The reading simulator is not connected yet.</NotConnectedNotice>
    </div>
  )
}

export default function DataInputPage() {
  const { user } = useAuth()
  const { status, error, factories, factory, processes, catalog, selectFactory, reload } = useDataInputContext()
  const [tab, setTab] = useState("manual")
  const [refreshKey, setRefreshKey] = useState(0)
  const onDataChanged = useCallback(() => setRefreshKey((key) => key + 1), [])

  const canWrite = !!user && OPERATIONAL_DATA_WRITERS.includes(user.role)

  const factorySelector =
    factories.length > 1 && factory ? (
      <Select aria-label="Factory" className="w-56" value={factory.id} onChange={(event) => selectFactory(Number(event.target.value))}>
        {factories.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
    ) : null

  let content
  if (status === "loading") {
    content = <LoadingState label="Loading factory data…" />
  } else if (status === "error" || !catalog) {
    content = <ErrorState message={error ?? undefined} onRetry={reload} />
  } else if (!factory || processes.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={FactoryIcon}
          title={factory ? "Add processes before recording data" : "Set up a factory first"}
          description={
            factory
              ? "Every activity belongs to a process such as Furnace or Boiler."
              : "Operational data is recorded against a factory and its processes."
          }
          action={
            <Link to="/factory" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Factory Setup
            </Link>
          }
        />
      </Card>
    )
  } else {
    content = (
      <div className="flex flex-col gap-6">
        {!canWrite && user && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Your role ({ROLE_LABELS[user.role]}) has read-only access to operational data. Factory operators and admins can record
              activities.
            </span>
          </div>
        )}
        <div>
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Data input method" className="mb-4" />
          {/* Panels stay mounted so switching tabs keeps form state, upload results and a running simulation. */}
          <Card>
            <CardContent className="pt-5">
              <div id="panel-manual" role="tabpanel" aria-labelledby="tab-manual" hidden={tab !== "manual"}>
                <ManualActivityForm processes={processes} catalog={catalog} readOnly={!canWrite} onCreated={onDataChanged} />
              </div>
              <div id="panel-csv" role="tabpanel" aria-labelledby="tab-csv" hidden={tab !== "csv"}>
                <CsvPanel />
              </div>
              <div id="panel-simulation" role="tabpanel" aria-labelledby="tab-simulation" hidden={tab !== "simulation"}>
                <SimulationPanel />
              </div>
            </CardContent>
          </Card>
        </div>
        <RecentActivitiesTable factoryId={factory.id} catalog={catalog} refreshKey={refreshKey} />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Data Input"
        description="Record operational activity manually, import a CSV, or stream simulated readings."
        actions={factorySelector}
      />
      {content}
    </>
  )
}
