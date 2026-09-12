import { getEmissionSummary } from './emissionAnalytics.service.js';
import { getHotspots } from './hotspot.service.js';
import { GENERAL_ASSUMPTIONS, listRecommendations } from './recommendation.service.js';
import { SCENARIO_ASSUMPTIONS, listScenarios } from './scenario.service.js';

/** How every figure in the report is produced — kept in step with the services that produce them. */
const METHODOLOGY = Object.freeze([
  'Emissions are calculated deterministically as activity quantity × emission factor (BR-01); each stored emission keeps the factor it used (BR-02).',
  "Hotspots rank processes by their share of the factory's calculated emissions, with severity from the configured thresholds (BR-03, BR-04).",
  'Recommendations match circular alternatives to recorded emissions and are scored 0.40 × environmental impact + 0.25 × financial benefit + 0.20 × feasibility + 0.15 × circularity (BR-06).',
  'Scenario projections come from the deterministic what-if engine and never modify baseline activities or emissions (BR-07).',
  'Simulated readings are included in the totals and reported separately (BR-12).',
]);

/**
 * Carbon assessment report of an authorized factory. Every number comes from the deterministic
 * services; calculated history, estimated recommendations and projected scenarios stay separate.
 */
export async function generateFactoryReport(factory, now = new Date()) {
  const [summary, hotspots, recommendations, scenarios] = await Promise.all([
    getEmissionSummary(factory, {}),
    getHotspots(factory, {}),
    listRecommendations(factory),
    listScenarios(factory),
  ]);

  return {
    factory: {
      id: factory.id,
      name: factory.name,
      industry: factory.industry_type ?? null,
      location: factory.location ?? null,
      productionCapacity: factory.production_capacity ?? null,
      productionUnit: factory.production_unit ?? null,
    },
    generatedAt: now.toISOString(),
    emissions: {
      total: summary.totals.co2e,
      unit: summary.co2eUnit,
      simulatedCo2e: summary.totals.simulatedCo2e,
      activityCount: summary.totals.activityCount,
      bySource: summary.bySource,
      byProcess: summary.byProcess,
      byDataSource: summary.byDataSource,
      intensity: summary.intensity,
      warnings: summary.warnings,
    },
    hotspots: hotspots.hotspots,
    recommendations: recommendations.recommendations,
    scenarios,
    methodology: METHODOLOGY,
    assumptions: [...new Set([...GENERAL_ASSUMPTIONS, ...SCENARIO_ASSUMPTIONS])],
  };
}
