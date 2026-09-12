import { useEffect, useState, useCallback } from "react"
import { Factory as FactoryIcon, Plus, Pencil, Trash2 } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import FormField from "@/components/forms/FormField"
import EmptyState from "@/components/feedback/EmptyState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { factoryService, type Factory, type Process } from "@/services/factoryService"

export default function FactorySetupPage() {
  const [factory, setFactory] = useState<Factory | null>(null)
  const [processes, setProcesses] = useState<Process[]>([])
  
  // Factory form state
  const [formData, setFormData] = useState({
    name: "",
    industryType: "",
    location: "",
    productionCapacity: "",
    productionUnit: ""
  })
  
  // Process form state
  const [isProcessFormOpen, setIsProcessFormOpen] = useState(false)
  const [editingProcessId, setEditingProcessId] = useState<number | null>(null)
  const [processFormData, setProcessFormData] = useState({
    name: "",
    processType: "",
    description: ""
  })

  const loadProcesses = useCallback(async (factoryId: number) => {
    try {
      const { data } = await factoryService.getProcesses(factoryId)
      setProcesses(data || [])
    } catch (error) {
      console.error("Failed to load processes", error)
    }
  }, [])

  const loadFactory = useCallback(async () => {
    try {
      const { data } = await factoryService.getFactories()
      if (data && data.length > 0) {
        const f = data[0]
        setFactory(f)
        setFormData({
          name: f.name || "",
          industryType: f.industry_type || "",
          location: f.location || "",
          productionCapacity: f.production_capacity?.toString() || "",
          productionUnit: f.production_unit || ""
        })
        loadProcesses(f.id)
      }
    } catch (error) {
      console.error("Failed to load factory", error)
    }
  }, [loadProcesses])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFactory()
  }, [loadFactory])

  const handleSaveFactory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        name: formData.name,
        industryType: formData.industryType || undefined,
        location: formData.location || undefined,
        productionCapacity: formData.productionCapacity ? Number(formData.productionCapacity) : undefined,
        productionUnit: formData.productionUnit || undefined
      }

      if (factory) {
        const { data } = await factoryService.updateFactory(factory.id, payload)
        setFactory(data)
      } else {
        const { data } = await factoryService.createFactory(payload)
        setFactory(data)
      }
      alert("Factory saved successfully!")
    } catch (error) {
      console.error("Failed to save factory", error)
      alert("Failed to save factory")
    }
  }

  const openProcessForm = (p?: Process) => {
    if (p) {
      setEditingProcessId(p.id)
      setProcessFormData({
        name: p.name || "",
        processType: p.process_type || "",
        description: p.description || ""
      })
    } else {
      setEditingProcessId(null)
      setProcessFormData({ name: "", processType: "", description: "" })
    }
    setIsProcessFormOpen(true)
  }

  const handleSaveProcess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factory) return

    try {
      const payload = {
        name: processFormData.name,
        processType: processFormData.processType || undefined,
        description: processFormData.description || undefined
      }

      if (editingProcessId) {
        await factoryService.updateProcess(factory.id, editingProcessId, payload)
      } else {
        await factoryService.createProcess(factory.id, payload)
      }
      
      await loadProcesses(factory.id)
      setIsProcessFormOpen(false)
    } catch (error) {
      console.error("Failed to save process", error)
      alert("Failed to save process")
    }
  }

  const handleDeleteProcess = async (processId: number) => {
    if (!factory) return
    if (!confirm("Are you sure you want to delete this process?")) return
    
    try {
      await factoryService.deleteProcess(factory.id, processId)
      await loadProcesses(factory.id)
    } catch (error) {
      console.error("Failed to delete process", error)
      alert("Failed to delete process")
    }
  }

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
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSaveFactory}>
              <div className="sm:col-span-2">
                <FormField label="Factory name" htmlFor="factory-name">
                  <Input 
                    id="factory-name" 
                    placeholder="ABC Metal Manufacturing" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </FormField>
              </div>
              <FormField label="Industry" htmlFor="factory-industry">
                <Input 
                  id="factory-industry" 
                  placeholder="Metal Components" 
                  value={formData.industryType}
                  onChange={e => setFormData({...formData, industryType: e.target.value})}
                />
              </FormField>
              <FormField label="Location" htmlFor="factory-location">
                <Input 
                  id="factory-location" 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </FormField>
              <FormField label="Production capacity" htmlFor="factory-capacity">
                <Input 
                  id="factory-capacity" 
                  type="number" 
                  min={0} 
                  value={formData.productionCapacity}
                  onChange={e => setFormData({...formData, productionCapacity: e.target.value})}
                />
              </FormField>
              <FormField label="Production unit" htmlFor="factory-unit">
                <Input 
                  id="factory-unit" 
                  placeholder="tonnes/year" 
                  value={formData.productionUnit}
                  onChange={e => setFormData({...formData, productionUnit: e.target.value})}
                />
              </FormField>
              <div className="flex flex-col gap-3 sm:col-span-2 mt-4">
                <Button type="submit" className="w-fit">
                  Save factory
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Processes</CardTitle>
              <CardDescription>Furnace, boiler, assembly, transport…</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => openProcessForm()} disabled={!factory || isProcessFormOpen}>
              <Plus className="h-4 w-4 mr-2" /> Add process
            </Button>
          </CardHeader>
          <CardContent>
            {!factory && (
              <EmptyState icon={FactoryIcon} title="Save factory first" description="You must save the factory profile before adding processes." />
            )}
            {factory && processes.length === 0 && !isProcessFormOpen && (
              <EmptyState icon={FactoryIcon} title="No processes yet" description="Add the processes that make up your factory to start recording activity data." />
            )}
            
            {isProcessFormOpen && (
              <div className="border p-4 rounded-md mb-4 bg-muted/30">
                <h3 className="font-medium mb-4">{editingProcessId ? "Edit Process" : "New Process"}</h3>
                <form className="grid gap-4" onSubmit={handleSaveProcess}>
                  <FormField label="Process Name" htmlFor="process-name">
                    <Input 
                      id="process-name" 
                      value={processFormData.name}
                      onChange={e => setProcessFormData({...processFormData, name: e.target.value})}
                      required
                    />
                  </FormField>
                  <FormField label="Process Type" htmlFor="process-type">
                    <Input 
                      id="process-type" 
                      placeholder="e.g. THERMAL, ELECTRICAL"
                      value={processFormData.processType}
                      onChange={e => setProcessFormData({...processFormData, processType: e.target.value})}
                    />
                  </FormField>
                  <FormField label="Description" htmlFor="process-desc">
                    <Input 
                      id="process-desc" 
                      value={processFormData.description}
                      onChange={e => setProcessFormData({...processFormData, description: e.target.value})}
                    />
                  </FormField>
                  <div className="flex gap-2 justify-end mt-2">
                    <Button type="button" variant="outline" onClick={() => setIsProcessFormOpen(false)}>Cancel</Button>
                    <Button type="submit">Save</Button>
                  </div>
                </form>
              </div>
            )}

            {!isProcessFormOpen && processes.length > 0 && (
              <div className="space-y-3">
                {processes.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 border rounded-md">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-muted-foreground">{p.process_type || "No type"}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openProcessForm(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProcess(p.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
