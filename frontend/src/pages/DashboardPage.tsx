import PageHeader from "@/components/PageHeader"
import MockDataNotice from "@/components/feedback/MockDataNotice"
import EmissionKpiCards from "@/components/dashboard/EmissionKpiCards"
import EnergyConsumptionChart from "@/components/dashboard/EnergyConsumptionChart"
import ChartContainer from "@/charts/ChartContainer"
import CategoryBarChart from "@/charts/CategoryBarChart"
import TrendLineChart from "@/charts/TrendLineChart"
import { formatPeriod } from "@/utils/format"
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
      <EmissionKpiCards
        total={{ value: mockKpis.totalEmissions, unit: mockKpis.emissionUnit }}
        production={{ value: mockKpis.production, unit: mockKpis.productionUnit }}
        intensity={{ value: mockKpis.emissionIntensity, unit: mockKpis.intensityUnit }}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Emissions by process" description="tCO2e">
          <CategoryBarChart data={mockEmissionsByProcess} unit="tCO2e" />
        </ChartContainer>
        <ChartContainer title="Emissions by source" description="tCO2e">
          <CategoryBarChart data={mockEmissionsBySource} unit="tCO2e" />
        </ChartContainer>
        <ChartContainer title="Historical emissions" description="Monthly tCO2e">
          <TrendLineChart data={mockEmissionHistory.map((point) => ({ label: formatPeriod(point.period), value: point.co2e }))} unit="tCO2e" />
        </ChartContainer>
        <EnergyConsumptionChart
          series={[{ activityType: "ELECTRICITY", label: "Electricity", unit: "kWh", history: mockElectricityHistory }]}
        />
      </div>
    </>
  )
}
