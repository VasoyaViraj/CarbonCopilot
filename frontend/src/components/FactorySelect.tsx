import { Select } from "@/components/ui/input"
import type { Factory } from "@/services/factoryService"

type FactorySelectProps = {
  factories: Factory[]
  value: number
  onChange: (factoryId: number) => void
}

/** Factory switcher for analysis screens; hidden when the organization has a single factory. */
export default function FactorySelect({ factories, value, onChange }: FactorySelectProps) {
  if (factories.length < 2) return null
  return (
    <Select aria-label="Factory" className="w-56" value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {factories.map((factory) => (
        <option key={factory.id} value={factory.id}>
          {factory.name}
        </option>
      ))}
    </Select>
  )
}
