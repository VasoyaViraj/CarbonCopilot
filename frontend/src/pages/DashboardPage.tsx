import { Factory, Gauge, Leaf } from "lucide-react"
import PageHeader from "@/components/PageHeader"
import DashboardCard from "@/components/DashboardCard"
import MockDataNotice from "@/components/feedback/MockDataNotice"
import ChartContainer from "@/charts/ChartContainer"
import CategoryBarChart from "@/charts/CategoryBarChart"
import TrendLineChart from "@/charts/TrendLineChart"
import { formatNumber } from "@/utils/format"
import {
  mockElectricityHistory,
  mockEmissionHistory,
  mockEmissionsByProcess,
  mockEmissionsBySource,
  mockKpis,
} from "@/mocks/fixtures"

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Carbon Dashboard"
        description="Estimated emissions calculated deterministically from activity data and emission factors."
        actions={<MockDataNotice />}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <DashboardCard label="Total emissions" value={formatNumber(mockKpis.totalEmissions)} unit={mockKpis.emissionUnit} icon={Leaf} />
        <DashboardCard label="Production" value={formatNumber(mockKpis.production)} unit={mockKpis.productionUnit} icon={Factory} />
        <DashboardCard
          label="Emission intensity"
          value={formatNumber(mockKpis.emissionIntensity, 3)}
          unit={mockKpis.intensityUnit}
          icon={Gauge}
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Emissions by process" description="tCO2e">
          <CategoryBarChart data={mockEmissionsByProcess} unit="tCO2e" />
        </ChartContainer>
        <ChartContainer title="Emissions by source" description="tCO2e">
          <CategoryBarChart data={mockEmissionsBySource} unit="tCO2e" />
        </ChartContainer>
        <ChartContainer title="Historical emissions" description="Monthly tCO2e">
          <TrendLineChart data={mockEmissionHistory} unit="tCO2e" />
        </ChartContainer>
        <ChartContainer title="Electricity consumption" description="Monthly kWh">
          <TrendLineChart data={mockElectricityHistory} unit="kWh" />
        </ChartContainer>
      </div>
    </>
  )
}
