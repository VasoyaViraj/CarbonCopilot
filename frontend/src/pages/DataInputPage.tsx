import { useState } from "react"
import { Play, Square } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FileUploader from "@/components/FileUploader"
import FormField from "@/components/forms/FormField"
import NotConnectedNotice from "@/components/feedback/NotConnectedNotice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input, Select } from "@/components/ui/input"
import { Tabs } from "@/components/ui/tabs"

const TABS = [
  { id: "manual", label: "Manual Input" },
  { id: "csv", label: "CSV Upload" },
  { id: "simulation", label: "Simulation" },
]

function ManualPanel() {
  return (
    <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
      <FormField label="Process" htmlFor="activity-process">
        <Select id="activity-process" defaultValue="" disabled>
          <option value="">No processes configured</option>
        </Select>
      </FormField>
      <FormField label="Activity date" htmlFor="activity-date">
        <Input id="activity-date" type="date" />
      </FormField>
      <FormField label="Energy / fuel / material" htmlFor="activity-type">
        <Select id="activity-type" defaultValue="">
          <option value="" disabled>
            Select type
          </option>
          <option value="ELECTRICITY">Electricity</option>
          <option value="NATURAL_GAS">Natural gas</option>
          <option value="DIESEL">Diesel</option>
        </Select>
      </FormField>
      <FormField label="Quantity" htmlFor="activity-quantity">
        <Input id="activity-quantity" type="number" min={0} step="any" />
      </FormField>
      <FormField label="Unit" htmlFor="activity-unit">
        <Input id="activity-unit" placeholder="kWh, m3, L" />
      </FormField>
      <FormField label="Production (tonnes)" htmlFor="activity-production">
        <Input id="activity-production" type="number" min={0} step="any" />
      </FormField>
      <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled className="w-fit">
          Save activity
        </Button>
        <NotConnectedNotice />
      </div>
    </form>
  )
}

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
  const [tab, setTab] = useState("manual")

  return (
    <>
      <PageHeader title="Data Input" description="Record operational activity manually, import a CSV, or stream simulated readings." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Data input method" className="mb-4" />
      <Card>
        <CardContent className="pt-5" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "manual" && <ManualPanel />}
          {tab === "csv" && <CsvPanel />}
          {tab === "simulation" && <SimulationPanel />}
        </CardContent>
      </Card>
    </>
  )
}
