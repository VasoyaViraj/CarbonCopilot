// Deterministic process-level hotspot engine (FR-05, BR-03, BR-04). No ML and no LLM: processes
// are ranked by their share of the factory's stored emissions and given a configurable severity.
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { describeFilters, loadFactoryActivities, percentOf, round, summarizeEmissions } from './emissionAnalytics.service.js';

export const SEVERITIES = Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

/** Severity thresholds in % of total emissions (defaults 40 / 25 / 10), set by HOTSPOT_*_PERCENT. */
export const HOTSPOT_THRESHOLDS = Object.freeze({
  critical: env.HOTSPOT_CRITICAL_PERCENT,
  high: env.HOTSPOT_HIGH_PERCENT,
  medium: env.HOTSPOT_MEDIUM_PERCENT,
});

/**
 * Severity of a contribution percentage (BR-04): above `critical` → CRITICAL, from `high` up to
 * `critical` → HIGH, from `medium` up to `high` → MEDIUM, below `medium` → LOW.
 */
export function classifySeverity(percentage, thresholds = HOTSPOT_THRESHOLDS) {
  if (percentage > thresholds.critical) return 'CRITICAL';
  if (percentage >= thresholds.high) return 'HIGH';
  if (percentage >= thresholds.medium) return 'MEDIUM';
  return 'LOW';
}

/**
 * Ranks processes by emissions: total = Σ process emissions, percentage = process / total × 100
 * (BR-03), sorted descending with the process name as a deterministic tie-break.
 *
 * - Input: [{ processId, process, emission, activityCount? }] with emissions in one CO2e unit.
 * - Processes without emissions stay in the ranking at 0%; non-finite or negative values count as 0.
 * - With a zero total there is nothing to rank, so `hotspots` is empty rather than all LOW.
 * - Severity uses the rounded percentage, so the displayed share and its label always agree.
 */
export function rankHotspots(processes, thresholds = HOTSPOT_THRESHOLDS) {
  const entries = processes.map((entry) => ({
    ...entry,
    emission: Number.isFinite(entry.emission) && entry.emission > 0 ? entry.emission : 0,
  }));
  const total = entries.reduce((sum, entry) => sum + entry.emission, 0);
  if (total === 0) return { totalEmission: 0, hotspots: [] };

  const hotspots = entries
    .sort((a, b) => b.emission - a.emission || a.process.localeCompare(b.process))
    .map((entry, index) => {
      const percentage = percentOf(entry.emission, total);
      return {
        rank: index + 1,
        processId: entry.processId,
        process: entry.process,
        emission: round(entry.emission),
        percentage,
        severity: classifySeverity(percentage, thresholds),
        activityCount: entry.activityCount ?? 0,
      };
    });
  return { totalEmission: round(total), hotspots };
}

// Hotspots depend on emissions only, so production/intensity warnings are not relevant here.
const EMISSION_WARNINGS = new Set(['MISSING_EMISSIONS', 'UNSUPPORTED_CO2E_UNIT']);

// Ranks the per-process totals of the same aggregation the dashboard uses, so both screens agree.
const rankSummary = (summary) =>
  rankHotspots(
    summary.byProcess.map(({ processId, process, co2e, activityCount }) => ({ processId, process, emission: co2e, activityCount }))
  );

/** Ranked hotspots of a factory the caller is already authorized for. Filters: from/to, source. */
export async function getHotspots(factory, query) {
  const { activities, processes } = await loadFactoryActivities(factory, query);
  const summary = summarizeEmissions({ activities, processes });
  const { totalEmission, hotspots } = rankSummary(summary);

  return {
    factory: { id: factory.id, name: factory.name },
    filters: describeFilters(query),
    co2eUnit: summary.co2eUnit,
    totalEmission,
    activityCount: summary.totals.activityCount,
    emissionCount: summary.totals.emissionCount,
    thresholds: HOTSPOT_THRESHOLDS,
    hotspots,
    warnings: summary.warnings.filter((warning) => EMISSION_WARNINGS.has(warning.code)),
  };
}

/**
 * One process's hotspot position plus what drives it: its emissions per source (share of the
 * process total), history, production and intensity. 404 when the process is not in the factory.
 */
export async function getHotspotDetail(factory, processId, query) {
  const { activities, processes } = await loadFactoryActivities(factory, query);
  const process = processes.find((entry) => entry.id === processId);
  if (!process) throw ApiError.notFound('Process');

  const { totalEmission, hotspots } = rankSummary(summarizeEmissions({ activities, processes }));
  const own = summarizeEmissions({
    activities: activities.filter((activity) => activity.process_id === processId),
    processes: [process],
    from: query.from,
    to: query.to,
  });

  return {
    factory: { id: factory.id, name: factory.name },
    filters: describeFilters(query),
    co2eUnit: own.co2eUnit,
    process: {
      id: process.id,
      name: process.name,
      processType: process.process_type ?? null,
      description: process.description ?? null,
    },
    // null when the factory has no emissions to rank in this period.
    hotspot: hotspots.find((entry) => entry.processId === processId) ?? null,
    factoryTotalEmission: totalEmission,
    rankedProcessCount: hotspots.length,
    thresholds: HOTSPOT_THRESHOLDS,
    emission: own.totals.co2e,
    simulatedEmission: own.totals.simulatedCo2e,
    activityCount: own.totals.activityCount,
    drivers: own.bySource,
    history: own.history,
    production: own.production,
    intensity: own.intensity,
    warnings: own.warnings,
  };
}
