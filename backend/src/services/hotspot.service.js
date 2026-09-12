// Deterministic process-level hotspot engine (FR-05, BR-03, BR-04). No ML and no LLM: processes
// are ranked by their share of the factory's stored emissions and given a configurable severity.
import { env } from '../config/env.js';
import { percentOf, round } from './emissionAnalytics.service.js';

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
