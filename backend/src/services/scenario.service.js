import prisma from '../db/db.js';
import { getEmissionSummary, REPORTING_CO2E_UNIT, round } from './emissionAnalytics.service.js';

const SAVINGS_PER_TONNE = 50; // $50 per tonne of CO2e reduced
const COST_PER_PERCENT = 5000; // $5000 cost for each 1% of intervention applied
const SCENARIO_CATEGORIES = Object.freeze({
  recycledMaterialPercent: 'MATERIAL',
  energyEfficiencyPercent: 'ENERGY',
  fuelReplacementPercent: 'FUEL',
  wasteRecoveryPercent: 'WASTE',
});

export const SCENARIO_ASSUMPTIONS = Object.freeze([
  `Savings are estimated at $${SAVINGS_PER_TONNE} per ${REPORTING_CO2E_UNIT} reduced.`,
  `Implementation cost is estimated at $${COST_PER_PERCENT} for each percentage point of intervention.`,
  'Baseline emissions are read from stored activity emissions and are never modified by scenario calculations.',
]);

export function toScenarioDto(row) {
  return {
    id: row.id,
    factoryId: row.factory_id,
    name: row.name,
    description: row.description,
    baselineEmission: row.baseline_emission,
    projectedEmission: row.projected_emission,
    reductionAmount: row.reduction_amount,
    reductionPercent: row.reduction_percent,
    estimatedCost: row.estimated_cost,
    estimatedSavings: row.estimated_savings,
    paybackPeriod: row.payback_period,
    unit: REPORTING_CO2E_UNIT,
    assumptions: SCENARIO_ASSUMPTIONS,
    createdAt: row.created_at.toISOString(),
  };
}

export async function calculateScenario(factory, parameters) {
  const summary = await getEmissionSummary(factory, {});
  const baselineEmission = summary.totals.co2e;

  const categoryEmissions = Object.fromEntries(Object.values(SCENARIO_CATEGORIES).map((category) => [category, 0]));
  for (const source of summary.bySource) {
    if (source.category && categoryEmissions[source.category] != null) {
      categoryEmissions[source.category] += source.co2e;
    }
  }

  const reductionAmount = Object.entries(SCENARIO_CATEGORIES).reduce(
    (sum, [parameter, category]) => sum + categoryEmissions[category] * (parameters[parameter] / 100),
    0
  );
  const projectedEmission = Math.max(0, baselineEmission - reductionAmount);
  const reductionPercent = baselineEmission > 0 ? (reductionAmount / baselineEmission) * 100 : 0;
  const totalInterventionPercent = Object.keys(SCENARIO_CATEGORIES).reduce((sum, key) => sum + parameters[key], 0);
  const estimatedCost = totalInterventionPercent * COST_PER_PERCENT;
  const estimatedSavings = reductionAmount * SAVINGS_PER_TONNE;
  const paybackPeriod = estimatedSavings > 0 ? estimatedCost / estimatedSavings : null;

  return {
    baselineEmission: round(baselineEmission),
    projectedEmission: round(projectedEmission),
    reductionAmount: round(reductionAmount),
    reductionPercent: round(reductionPercent, 2),
    estimatedCost: round(estimatedCost, 2),
    estimatedSavings: round(estimatedSavings, 2),
    paybackPeriod: paybackPeriod == null ? null : round(paybackPeriod, 2),
    unit: REPORTING_CO2E_UNIT,
    assumptions: SCENARIO_ASSUMPTIONS,
  };
}

export async function saveScenario(factory, payload) {
  const calculation = await calculateScenario(factory, payload);
  
  const scenario = await prisma.scenario.create({
    data: {
      factory_id: factory.id,
      name: payload.name,
      description: payload.description || null,
      baseline_emission: calculation.baselineEmission,
      projected_emission: calculation.projectedEmission,
      reduction_amount: calculation.reductionAmount,
      reduction_percent: calculation.reductionPercent,
      estimated_cost: calculation.estimatedCost,
      estimated_savings: calculation.estimatedSavings,
      payback_period: calculation.paybackPeriod,
    },
  });

  return toScenarioDto(scenario);
}

export async function listScenarios(factory) {
  const scenarios = await prisma.scenario.findMany({
    where: { factory_id: factory.id },
    orderBy: { created_at: 'desc' },
  });
  return scenarios.map(toScenarioDto);
}
