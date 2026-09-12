import { useCallback, useState } from "react"
import { Link } from "react-router"
import { Factory as FactoryIcon, Lock } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import EmptyState from "@/components/feedback/EmptyState"
import ErrorState from "@/components/feedback/ErrorState"
import LoadingState from "@/components/feedback/LoadingState"
import CsvImportPanel from "@/components/data-input/CsvImportPanel"
import ManualActivityForm from "@/components/data-input/ManualActivityForm"
import RecentActivitiesTable from "@/components/data-input/RecentActivitiesTable"
import SimulationPanel from "@/components/data-input/SimulationPanel"
import { buttonVariants } from "@/components/ui/button"
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
                <CsvImportPanel factoryId={factory.id} catalog={catalog} readOnly={!canWrite} onImported={onDataChanged} />
              </div>
              <div id="panel-simulation" role="tabpanel" aria-labelledby="tab-simulation" hidden={tab !== "simulation"}>
                <SimulationPanel processes={processes} catalog={catalog} readOnly={!canWrite} onReading={onDataChanged} />
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
