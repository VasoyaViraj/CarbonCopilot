// Carbon dashboard analytics (Phase 7). Aggregates the emissions the deterministic carbon engine
// already stored (BR-01, BR-02) — nothing is recalculated here and no LLM is involved. Clients
// display these figures; they never compute authoritative totals themselves.
import prisma from '../db/db.js';
import { ACTIVITY_SOURCES } from '../constants.js';
import { ACTIVITY_TYPES, PRODUCTION_UNITS } from '../config/activityCatalog.js';
import { activityWhere } from './activity.service.js';
import { toEmissionDto } from './carbon.service.js';

/** Dashboard figures are reported in tonnes of CO2e. */
export const REPORTING_CO2E_UNIT = 'tCO2e';

// Mass conversions used for reporting only. Activity quantities are never converted.
const CO2E_TO_TONNES = Object.freeze({ kgCO2e: 0.001, tCO2e: 1 });
const PRODUCTION_TO_TONNES = Object.freeze({ tonnes: 1, kg: 0.001 });
const INTENSITY_DENOMINATORS = Object.freeze({ tonnes: 'tonne', units: 'unit' });
const PRODUCTION_UNIT_ORDER = Object.keys(PRODUCTION_UNITS);
const unitRank = (unit) => (PRODUCTION_UNIT_ORDER.includes(unit) ? PRODUCTION_UNIT_ORDER.indexOf(unit) : PRODUCTION_UNIT_ORDER.length);

// Categories whose quantities are energy consumption (the dashboard's energy chart).
const CONSUMPTION_CATEGORIES = new Set(['ENERGY', 'FUEL']);

const DAY_MS = 24 * 60 * 60 * 1000;
const TYPE_ORDER = Object.keys(ACTIVITY_TYPES);
const LATEST_EMISSION = { orderBy: [{ calculated_at: 'desc' }, { id: 'desc' }], take: 1 };

// Rounds away float noise (0.1 + 0.2) so identical inputs always serialise identically.
export const round = (value, digits = 6) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

/** Share of a total as a percentage; 0 when the total is 0, never NaN. */
export const percentOf = (part, total) => (total > 0 ? round((part / total) * 100, 2) : 0);

/** UTC bucket key: YYYY-MM-DD for daily series, YYYY-MM for monthly ones. */
export function periodKey(date, granularity) {
  const iso = date.toISOString();
  return granularity === 'day' ? iso.slice(0, 10) : iso.slice(0, 7);
}

function nextPeriod(key, granularity) {
  if (granularity === 'day') return new Date(Date.parse(`${key}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  const [year, month] = key.split('-').map(Number);
  // `month` is 1-based, so Date.UTC(year, month) is the first day of the following month.
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

/** Every period from first to last inclusive, so charts show gaps as zero instead of joining distant points. */
function periodSequence(first, last, granularity) {
  const keys = [];
  if (!first || !last) return keys;
  for (let key = first; key <= last; key = nextPeriod(key, granularity)) keys.push(key);
  return keys;
}

const entryFor = (map, key, create) => {
  if (!map.has(key)) map.set(key, create());
  return map.get(key);
};

/**
 * Production is summed per unit. Mass units combine into tonnes; a count unit (units) cannot be
 * combined with mass, so mixed data has no single production figure.
 */
function summarizeProduction(productionByUnit) {
  const byUnit = [...productionByUnit]
    .map(([unit, quantity]) => ({ unit, quantity: round(quantity) }))
    .sort((a, b) => unitRank(a.unit) - unitRank(b.unit) || a.unit.localeCompare(b.unit));
  const mass = [...productionByUnit].filter(([unit]) => PRODUCTION_TO_TONNES[unit] != null);
  const counts = [...productionByUnit].filter(([unit]) => PRODUCTION_TO_TONNES[unit] == null);

  if (mass.length > 0 && counts.length > 0) return { quantity: null, unit: null, byUnit, mixed: true };
  if (counts.length > 1) return { quantity: null, unit: null, byUnit, mixed: true };
  if (mass.length > 0) {
    const tonnes = mass.reduce((sum, [unit, quantity]) => sum + quantity * PRODUCTION_TO_TONNES[unit], 0);
    return { quantity: round(tonnes), unit: 'tonnes', byUnit, mixed: false };
  }
  if (counts.length === 1) return { quantity: round(counts[0][1]), unit: counts[0][0], byUnit, mixed: false };
  return { quantity: 0, unit: null, byUnit, mixed: false };
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * Aggregates activities (each carrying its latest stored emission as `emissions[0]`) into the
 * dashboard summary. Pure and deterministic: the same rows always produce the same summary.
 *
 * - Totals, process/source/data-source breakdowns and history are in tCO2e.
 * - Emission intensity = total CO2e / production (BR-05), or null when production is missing
 *   or recorded in incompatible units.
 * - Activities without a stored emission are excluded from CO2e figures and reported in warnings.
 */
export function summarizeEmissions({ activities, processes = [], granularity = 'month', from = null, to = null }) {
  const processTotals = new Map(
    processes.map((process) => [process.id, { processId: process.id, process: process.name, co2e: 0, activityCount: 0 }])
  );
  const typeTotals = new Map();
  const dataSourceTotals = new Map();
  const historyTotals = new Map();
  const consumption = new Map();
  const productionByUnit = new Map();
  const unsupportedUnits = new Set();
  let total = 0;
  let simulated = 0;
  let emissionCount = 0;
  let missingEmissions = 0;

  for (const activity of activities) {
    const period = periodKey(activity.activity_date, granularity);
    const type = ACTIVITY_TYPES[activity.energy_type];
    const processEntry = entryFor(processTotals, activity.process_id, () => ({
      processId: activity.process_id,
      process: activity.process?.name ?? `Process #${activity.process_id}`,
      co2e: 0,
      activityCount: 0,
    }));
    const sourceEntry = entryFor(dataSourceTotals, activity.source, () => ({ co2e: 0, activityCount: 0 }));
    processEntry.activityCount += 1;
    sourceEntry.activityCount += 1;

    if (activity.production_quantity != null && activity.production_unit) {
      productionByUnit.set(activity.production_unit, (productionByUnit.get(activity.production_unit) ?? 0) + activity.production_quantity);
    }

    if (type && CONSUMPTION_CATEGORIES.has(type.category)) {
      const series = entryFor(consumption, activity.energy_type, () => ({
        activityType: activity.energy_type,
        label: type.label,
        category: type.category,
        unit: type.unit,
        total: 0,
        byPeriod: new Map(),
      }));
      series.total += activity.quantity;
      series.byPeriod.set(period, (series.byPeriod.get(period) ?? 0) + activity.quantity);
    }

    const emission = activity.emissions?.[0];
    if (!emission) {
      missingEmissions += 1;
      continue;
    }
    const toTonnes = CO2E_TO_TONNES[emission.co2e_unit];
    if (toTonnes == null) {
      unsupportedUnits.add(emission.co2e_unit);
      continue;
    }

    const co2e = emission.co2e_value * toTonnes;
    emissionCount += 1;
    total += co2e;
    if (activity.source === ACTIVITY_SOURCES.SIMULATION) simulated += co2e;
    processEntry.co2e += co2e;
    sourceEntry.co2e += co2e;
    entryFor(typeTotals, activity.energy_type, () => ({
      activityType: activity.energy_type,
      label: type?.label ?? activity.energy_type,
      category: type?.category ?? null,
      co2e: 0,
    })).co2e += co2e;
    entryFor(historyTotals, period, () => ({ co2e: 0 })).co2e += co2e;
  }

  const dataPeriods = [...new Set(activities.map((activity) => periodKey(activity.activity_date, granularity)))].sort();
  const periods = periodSequence(
    from ? periodKey(from, granularity) : dataPeriods[0],
    to ? periodKey(to, granularity) : dataPeriods.at(-1),
    granularity
  );

  const production = summarizeProduction(productionByUnit);
  const denominator = INTENSITY_DENOMINATORS[production.unit];
  const intensity = {
    value: denominator && production.quantity > 0 ? round(total / production.quantity) : null,
    unit: denominator ? `${REPORTING_CO2E_UNIT}/${denominator}` : null,
  };

  const warnings = [];
  if (missingEmissions > 0) {
    warnings.push({
      code: 'MISSING_EMISSIONS',
      message: `${plural(missingEmissions, 'activity has', 'activities have')} no calculated emission and ${missingEmissions === 1 ? 'is' : 'are'} excluded from the totals.`,
    });
  }
  if (unsupportedUnits.size > 0) {
    warnings.push({
      code: 'UNSUPPORTED_CO2E_UNIT',
      message: `Emissions stored in ${[...unsupportedUnits].sort().join(', ')} cannot be reported in ${REPORTING_CO2E_UNIT} and are excluded.`,
    });
  }
  if (production.mixed) {
    warnings.push({
      code: 'MIXED_PRODUCTION_UNITS',
      message: 'Production is recorded in incompatible units, so emission intensity cannot be calculated.',
    });
  } else if (activities.length > 0 && !(production.quantity > 0)) {
    warnings.push({
      code: 'NO_PRODUCTION',
      message: 'No production quantity is recorded for this period, so emission intensity cannot be calculated.',
    });
  }

  const withShare = (entry) => ({ ...entry, co2e: round(entry.co2e), percentage: percentOf(entry.co2e, total) });

  return {
    co2eUnit: REPORTING_CO2E_UNIT,
    totals: {
      co2e: round(total),
      simulatedCo2e: round(simulated),
      activityCount: activities.length,
      emissionCount,
    },
    production: { quantity: production.quantity, unit: production.unit, byUnit: production.byUnit },
    intensity,
    byProcess: [...processTotals.values()]
      .map(withShare)
      .sort((a, b) => b.co2e - a.co2e || a.process.localeCompare(b.process)),
    bySource: [...typeTotals.values()]
      .map(withShare)
      .sort((a, b) => b.co2e - a.co2e || TYPE_ORDER.indexOf(a.activityType) - TYPE_ORDER.indexOf(b.activityType)),
    byDataSource: Object.values(ACTIVITY_SOURCES)
      .filter((source) => dataSourceTotals.has(source))
      .map((source) => ({
        source,
        // Simulated readings are labelled everywhere they appear (BR-12).
        isSimulated: source === ACTIVITY_SOURCES.SIMULATION,
        ...withShare(dataSourceTotals.get(source)),
      })),
    history: periods.map((period) => ({ period, co2e: round(historyTotals.get(period)?.co2e ?? 0) })),
    energy: [...consumption.values()]
      .sort((a, b) => TYPE_ORDER.indexOf(a.activityType) - TYPE_ORDER.indexOf(b.activityType))
      .map(({ byPeriod, total: quantity, ...series }) => ({
        ...series,
        total: round(quantity),
        history: periods.map((period) => ({ period, quantity: round(byPeriod.get(period) ?? 0) })),
      })),
    warnings,
  };
}

const toDateOnly = (date) => (date ? date.toISOString().slice(0, 10) : null);

const summarySelect = {
  id: true,
  process_id: true,
  activity_date: true,
  energy_type: true,
  quantity: true,
  unit: true,
  production_quantity: true,
  production_unit: true,
  source: true,
  process: { select: { name: true } },
  emissions: { select: { co2e_value: true, co2e_unit: true }, ...LATEST_EMISSION },
};

/**
 * A factory's activities (each with its latest stored emission) and processes, narrowed by the
 * shared filters (from/to inclusive days, source). The factory must already be authorized.
 */
export async function loadFactoryActivities(factory, query) {
  const [activities, processes] = await Promise.all([
    prisma.activity.findMany({ where: activityWhere({ factoryId: factory.id }, query), select: summarySelect }),
    prisma.process.findMany({
      where: { factory_id: factory.id },
      select: { id: true, name: true, process_type: true, description: true },
    }),
  ]);
  return { activities, processes };
}

/** The date/source filters echoed back by analytics responses. */
export const describeFilters = (query) => ({
  from: toDateOnly(query.from),
  to: toDateOnly(query.to),
  source: query.source ?? null,
});

/**
 * Dashboard summary for a factory the caller is already authorized for. Filters: from/to
 * (inclusive days), source, granularity (day | month).
 */
export async function getEmissionSummary(factory, query) {
  const { activities, processes } = await loadFactoryActivities(factory, query);
  return {
    factory: { id: factory.id, name: factory.name },
    filters: { ...describeFilters(query), granularity: query.granularity },
    ...summarizeEmissions({ activities, processes, granularity: query.granularity, from: query.from, to: query.to }),
  };
}

/** API view of a stored emission with the activity and the factor that explain it (BR-02). */
export function toEmissionRecordDto(emission) {
  const { activity, emission_factor: factor } = emission;
  return {
    ...toEmissionDto(emission),
    activityId: emission.activity_id,
    processId: activity.process_id,
    processName: activity.process?.name ?? null,
    activityDate: activity.activity_date.toISOString(),
    energyType: activity.energy_type,
    category: ACTIVITY_TYPES[activity.energy_type]?.category ?? null,
    quantity: activity.quantity,
    unit: activity.unit,
    source: activity.source,
    isSimulated: activity.source === ACTIVITY_SOURCES.SIMULATION,
    factor: {
      id: factor.id,
      value: factor.factor,
      unit: `${factor.co2e_unit}/${factor.unit}`,
      region: factor.region,
      year: factor.year,
      reference: factor.reference,
    },
  };
}

/** Stored emissions of a factory's activities, newest activity first. */
export async function listEmissions(factory, query) {
  const where = { activity: activityWhere({ factoryId: factory.id, processId: query.processId }, query) };
  const [items, total] = await Promise.all([
    prisma.emission.findMany({
      where,
      include: { activity: { include: { process: { select: { id: true, name: true } } } }, emission_factor: true },
      orderBy: [{ activity: { activity_date: 'desc' } }, { id: 'desc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.emission.count({ where }),
  ]);
  return { items: items.map(toEmissionRecordDto), total, limit: query.limit, offset: query.offset };
}
