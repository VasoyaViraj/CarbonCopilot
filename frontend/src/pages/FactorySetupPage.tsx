import { Factory } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FormField from "@/components/forms/FormField"
import EmptyState from "@/components/feedback/EmptyState"
import NotConnectedNotice from "@/components/feedback/NotConnectedNotice"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function FactorySetupPage() {
  return (
    <>
      <PageHeader title="Factory Setup" description="Describe your site and the processes that consume energy, fuel and materials." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Factory profile</CardTitle>
              <CardDescription>Used to normalise emission intensity.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
              <div className="sm:col-span-2">
                <FormField label="Factory name" htmlFor="factory-name">
                  <Input id="factory-name" placeholder="ABC Metal Manufacturing" />
                </FormField>
              </div>
              <FormField label="Industry" htmlFor="factory-industry">
                <Input id="factory-industry" placeholder="Metal Components" />
              </FormField>
              <FormField label="Location" htmlFor="factory-location">
                <Input id="factory-location" />
              </FormField>
              <FormField label="Production capacity" htmlFor="factory-capacity">
                <Input id="factory-capacity" type="number" min={0} />
              </FormField>
              <FormField label="Production unit" htmlFor="factory-unit">
                <Input id="factory-unit" placeholder="tonnes/year" />
              </FormField>
              <div className="flex flex-col gap-3 sm:col-span-2">
                <Button type="submit" disabled className="w-fit">
                  Save factory
                </Button>
                <NotConnectedNotice />
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Processes</CardTitle>
              <CardDescription>Furnace, boiler, assembly, transport…</CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              Add process
            </Button>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Factory} title="No processes yet" description="Add the processes that make up your factory to start recording activity data." />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
