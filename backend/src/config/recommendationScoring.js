// Deterministic recommendation scoring configuration (FR-08, BR-06). Every score depends on these
// values, so they live in one reviewed place rather than being tuned per request.

/** BR-06 default weights (they sum to 1). */
export const SCORE_WEIGHTS = Object.freeze({
  environmentalImpact: 0.4,
  financialBenefit: 0.25,
  feasibility: 0.2,
  circularity: 0.15,
});

/** Avoiding this share (%) of a factory's emissions earns the full environmental score. */
export const FULL_IMPACT_SHARE_PERCENT = 10;

/** Payback (years) at which the financial score reaches 0; immediate payback scores 100. */
export const PAYBACK_HORIZON_YEARS = 10;

/** Knowledge-base levels on the common 0–100 scale: lower difficulty or cost is more feasible. */
export const LEVEL_SCORES = Object.freeze({ LOW: 100, MEDIUM: 60, HIGH: 20 });

/** Score for a missing difficulty or cost level (reported as an assumption). */
export const UNKNOWN_LEVEL_SCORE = 50;

/** Annual estimates are based on the emissions of this trailing window. */
export const BASELINE_DAYS = 365;

const THERMAL_PROCESS = /furnace|kiln|oven/i;

/**
 * Which recorded emissions each knowledge-base `current_option` replaces.
 * - FACTORY scope: the listed activity types across the whole factory (one recommendation).
 * - PROCESS scope: the listed activity types in each process whose name matches `processPattern`.
 * Alternatives without an entry (e.g. packaging, which no activity type measures yet) are reported
 * as unmatched rather than recommended.
 */
export const INTERVENTION_TARGETS = Object.freeze({
  virgin_aluminum: { scope: 'FACTORY', activityTypes: ['VIRGIN_ALUMINUM'] },
  natural_gas: { scope: 'FACTORY', activityTypes: ['NATURAL_GAS'] },
  grid_electricity: { scope: 'FACTORY', activityTypes: ['ELECTRICITY'] },
  standard_motors: { scope: 'FACTORY', activityTypes: ['ELECTRICITY'] },
  aluminum_scrap_disposal: { scope: 'FACTORY', activityTypes: ['WASTE_LANDFILL'] },
  landfill_metal_scrap: { scope: 'FACTORY', activityTypes: ['WASTE_LANDFILL'] },
  process_waste_landfill: { scope: 'FACTORY', activityTypes: ['WASTE_LANDFILL'] },
  furnace_exhaust_heat: { scope: 'PROCESS', activityTypes: ['NATURAL_GAS'], processPattern: THERMAL_PROCESS },
  furnace_operation: { scope: 'PROCESS', activityTypes: ['NATURAL_GAS'], processPattern: THERMAL_PROCESS },
  manual_furnace_control: { scope: 'PROCESS', activityTypes: ['NATURAL_GAS'], processPattern: THERMAL_PROCESS },
  standard_boiler: { scope: 'PROCESS', activityTypes: ['NATURAL_GAS'], processPattern: /boiler/i },
});
