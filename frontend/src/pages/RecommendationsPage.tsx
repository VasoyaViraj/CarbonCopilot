import PageHeader from "@/components/PageHeader"
import RecommendationCard from "@/components/RecommendationCard"
import MockDataNotice from "@/components/feedback/MockDataNotice"
import { mockRecommendations } from "@/mocks/fixtures"

export default function RecommendationsPage() {
  return (
    <>
      <PageHeader
        title="Circular Recommendations"
        description="Interventions ranked by a deterministic score: 40% environmental impact, 25% financial benefit, 20% feasibility, 15% circularity."
        actions={<MockDataNotice />}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockRecommendations.map((rec, index) => (
          <RecommendationCard
            key={rec.id}
            rank={index + 1}
            title={rec.title}
            category={rec.category}
            reductionPercent={rec.reductionPercent}
            costLevel={rec.costLevel}
            paybackYears={rec.paybackYears}
            score={rec.score}
            reason={rec.reason}
          />
        ))}
      </div>
    </>
  )
}
