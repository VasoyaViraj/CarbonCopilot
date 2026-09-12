import prisma from '../db/db.js';
import { loadFactoryActivities, summarizeEmissions } from './emissionAnalytics.service.js';
import { getHotspots } from './hotspot.service.js';
import { listRecommendations } from './recommendation.service.js';
import { listScenarios } from './scenario.service.js';

export async function generateFactoryReport(factory) {
  // 1. Fetch activities & summarize emissions
  const { activities, processes } = await loadFactoryActivities(factory, {});
  const emissionSummary = summarizeEmissions({ activities, processes });
  
  // 2. Hotspots
  const hotspotsData = await getHotspots(factory, {});

  // 3. Recommendations
  const recommendationsData = await listRecommendations(factory);

  // 4. Projected Reductions / Scenarios
  const scenariosData = await listScenarios(factory.id);

  // 5. Build final report payload
  return {
    factory: {
      id: factory.id,
      name: factory.name,
      location: factory.location || 'N/A',
      industry: factory.industry || 'N/A',
      size: factory.size || 'N/A',
      productionUnit: factory.production_unit || 'N/A',
    },
    emissions: {
      total: emissionSummary.totals.co2e,
      unit: emissionSummary.co2eUnit,
      bySource: emissionSummary.bySource,
      byProcess: emissionSummary.byProcess,
      intensity: emissionSummary.intensity,
    },
    hotspots: hotspotsData.hotspots,
    recommendations: recommendationsData.recommendations,
    scenarios: scenariosData,
    methodology: [
      "Emissions are calculated using standard emission factors deterministically.",
      "Hotspots are ranked by their percentage contribution to the total calculated factory emissions.",
      "Recommendations are algorithmically suggested interventions based on top hotspots and generic industry circular alternatives.",
      "Scenario projections are strictly mathematical differences applied against the historical baseline."
    ],
    assumptions: [
      "Future production levels are assumed to remain constant when projecting scenario impacts.",
      "Costs and savings for recommendations are median estimates based on the industry baseline."
    ]
  };
}
