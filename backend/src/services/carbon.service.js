// Deterministic carbon engine (BR-01, BR-02, ADR-003). No LLM is involved anywhere here:
// CO2e = activity quantity × emission factor, using a persisted, versioned factor record.
import prisma from '../db/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ACTIVITY_TYPES } from '../config/activityCatalog.js';

export const CALCULATION_METHOD = 'CO2e = activity quantity × emission factor';

// Newest factor year wins; the id breaks ties so the same inputs always resolve to the same factor.
const FACTOR_ORDER = [{ year: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }];

const factorKey = (activityType, unit) => `${activityType}|${unit}`;

export const missingFactorMessage = (activityType, unit) => `No emission factor is configured for ${activityType} in ${unit}`;

/**
 * Deterministic multiplication. The quantity must be in the factor's activity unit; the
 * result is in the factor's CO2e unit. Units are never converted implicitly.
 */
export function calculateEmissionValue(quantity, factorValue, inputUnit, factorUnit) {
  if (!Number.isFinite(quantity)) {
    throw ApiError.badRequest('Quantity must be a finite number.', [{ field: 'quantity', message: 'Must be a finite number' }]);
  }
  if (quantity < 0) {
    throw ApiError.badRequest('Quantity cannot be negative.', [{ field: 'quantity', message: 'Must not be negative' }]);
  }
  if (!Number.isFinite(factorValue) || factorValue < 0) {
    throw ApiError.badRequest('Emission factor must be a non-negative number.', [{ field: 'factor', message: 'Invalid factor value' }]);
  }
  if (inputUnit !== factorUnit) {
    throw ApiError.badRequest(`Incompatible units. Input unit: ${inputUnit}, Factor unit: ${factorUnit}`, [
      { field: 'unit', message: `Must be ${factorUnit}` },
    ]);
  }
  return quantity * factorValue;
}

/**
 * Finds the emission factor for an activity type and unit, or validates an explicitly chosen
 * factor. Throws VALIDATION_ERROR when none applies, so no emission is stored without a factor.
 */
export async function findEmissionFactor({ activityType, unit, emissionFactorId }, db = prisma) {
  const type = ACTIVITY_TYPES[activityType];
  if (!type) {
    throw ApiError.badRequest(`Unsupported activity type "${activityType}"`, [{ field: 'energyType', message: 'Unsupported activity type' }]);
  }

  if (emissionFactorId != null) {
    const factor = await db.emissionFactor.findUnique({ where: { id: emissionFactorId } });
    if (!factor || factor.fuel_type !== activityType || factor.unit !== unit) {
      throw ApiError.badRequest(`Emission factor ${emissionFactorId} does not apply to ${activityType} in ${unit}`, [
        { field: 'emissionFactorId', message: `Is not a factor for ${activityType} (${unit})` },
      ]);
    }
    return factor;
  }

  const factor = await db.emissionFactor.findFirst({
    where: { category: type.category, fuel_type: activityType, unit },
    orderBy: FACTOR_ORDER,
  });
  if (!factor) {
    throw ApiError.badRequest(missingFactorMessage(activityType, unit), [
      { field: 'energyType', message: `${missingFactorMessage(activityType, unit)} — an admin must add one` },
    ]);
  }
  return factor;
}

/** Resolves factors for many (type, unit) pairs in one query. Pairs without a factor are absent from the map. */
export async function resolveEmissionFactors(pairs, db = prisma) {
  const unique = [...new Map(pairs.map((pair) => [factorKey(pair.activityType, pair.unit), pair])).values()];
  if (unique.length === 0) return new Map();
  const factors = await db.emissionFactor.findMany({
    where: {
      OR: unique.map(({ activityType, unit }) => ({ category: ACTIVITY_TYPES[activityType]?.category, fuel_type: activityType, unit })),
    },
    orderBy: FACTOR_ORDER,
  });
  const byPair = new Map();
  for (const factor of factors) {
    const key = factorKey(factor.fuel_type, factor.unit);
    if (!byPair.has(key)) byPair.set(key, factor);
  }
  return byPair;
}

export const getFactor = (factors, activityType, unit) => factors.get(factorKey(activityType, unit));

/** Structured calculation result (activity, factor, quantity, unit, CO2e, method) — nothing is persisted. */
export function toCalculationResult({ activityType, quantity, unit }, factor) {
  return {
    activityType,
    quantity,
    unit,
    emissionFactorId: factor.id,
    factor: factor.factor,
    factorUnit: `${factor.co2e_unit}/${factor.unit}`,
    factorSource: { region: factor.region, year: factor.year, reference: factor.reference },
    co2eValue: calculateEmissionValue(quantity, factor.factor, unit, factor.unit),
    co2eUnit: factor.co2e_unit,
    calculationMethod: CALCULATION_METHOD,
  };
}

/**
 * Pure calculation for arbitrary input — the capability the `calculate_emissions` MCP tool
 * exposes (activity type, quantity, unit, optional factor id). Nothing is written.
 */
export async function calculateEmissions({ activityType, quantity, unit, emissionFactorId }, db = prisma) {
  const factor = await findEmissionFactor({ activityType, unit, emissionFactorId }, db);
  return toCalculationResult({ activityType, quantity, unit }, factor);
}

/** Emission row for a persisted activity. The factor id is stored so history stays explainable when factors change (BR-02). */
export function buildEmissionData(activity, factor) {
  return {
    activity_id: activity.id,
    emission_factor_id: factor.id,
    co2e_value: calculateEmissionValue(activity.quantity, factor.factor, activity.unit, factor.unit),
    co2e_unit: factor.co2e_unit,
    calculation_method: CALCULATION_METHOD,
  };
}

export function toEmissionDto(emission) {
  if (!emission) return null;
  return {
    id: emission.id,
    co2eValue: emission.co2e_value,
    co2eUnit: emission.co2e_unit,
    emissionFactorId: emission.emission_factor_id,
    calculationMethod: emission.calculation_method,
    calculatedAt: emission.calculated_at ? new Date(emission.calculated_at).toISOString() : null,
  };
}

/**
 * (Re)calculates and stores the emission of one persisted activity. Idempotent: an existing
 * emission for the activity is replaced rather than duplicated, so totals never double count.
 * Accepts a transaction client to run inside a caller's transaction.
 */
export async function processActivityEmission(activityId, db = prisma) {
  const run = async (tx) => {
    const activity = await tx.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw ApiError.notFound('Activity');
    const factor = await findEmissionFactor({ activityType: activity.energy_type, unit: activity.unit }, tx);
    await tx.emission.deleteMany({ where: { activity_id: activity.id } });
    return tx.emission.create({ data: buildEmissionData(activity, factor) });
  };
  return typeof db.$transaction === 'function' ? db.$transaction(run) : run(db);
}
