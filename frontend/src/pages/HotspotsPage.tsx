import PageHeader from "@/components/PageHeader"
import HotspotCard from "@/components/HotspotCard"
import MockDataNotice from "@/components/feedback/MockDataNotice"
import { mockHotspots } from "@/mocks/fixtures"

export default function HotspotsPage() {
  return (
    <>
      <PageHeader
        title="Hotspot Analysis"
        description="Processes ranked by their share of total estimated emissions. Severity: >40% critical, 25–40% high, 10–25% medium, <10% low."
        actions={<MockDataNotice />}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockHotspots.map((hotspot, index) => (
          <HotspotCard
            key={hotspot.processId}
            rank={index + 1}
            process={hotspot.process}
            emission={hotspot.emission}
            unit="tCO2e"
            percentage={hotspot.percentage}
            severity={hotspot.severity}
          />
        ))}
      </div>
    </>
  )
}
