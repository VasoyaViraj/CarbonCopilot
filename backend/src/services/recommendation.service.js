// Deterministic intervention scoring (FR-08; BR-06, BR-09, BR-11, BR-15). Candidates come from the
// circular alternatives knowledge base, matched to the emissions a factory actually recorded. Every
// number is calculated here — an LLM may later explain a score, but never produces one.
import prisma from '../db/db.js';
import { ACTIVITY_TYPES } from '../config/activityCatalog.js';
import {
  BASELINE_DAYS,
  FULL_IMPACT_SHARE_PERCENT,
  INTERVENTION_TARGETS,
  LEVEL_SCORES,
  PAYBACK_HORIZON_YEARS,
  SCORE_WEIGHTS,
  UNKNOWN_LEVEL_SCORE,
} from '../config/recommendationScoring.js';
import { RECOMMENDATION_STATUSES } from '../constants.js';
import {
  REPORTING_CO2E_UNIT,
  loadFactoryActivities,
  percentOf,
  round,
  summarizeEmissions,
  toTonnes,
} from './emissionAnalytics.service.js';
import { rankHotspots } from './hotspot.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACRONYMS = Object.freeze({ ai: 'AI', vfd: 'VFD' });
const EMISSION_WARNINGS = new Set(['MISSING_EMISSIONS', 'UNSUPPORTED_CO2E_UNIT']);
const RECOMMENDATION_INCLUDE = { alternative: true, process: { select: { id: true, name: true } } };

export const GENERAL_ASSUMPTIONS = Object.freeze([
  'Annual estimates use the emissions recorded in the 12 months before the recommendations were generated.',
  'Reduction, cost level, difficulty, payback and circularity come from the circular alternatives knowledge base (illustrative values).',
  'Alternatives that target the same emissions overlap, so their savings are not additive.',
  'Scores are calculated deterministically (BR-06). They support a decision; they are not guaranteed savings.',
]);

const clamp = (value) => Math.min(100, Math.max(0, value));
const formatTonnes = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
const toDateOnly = (date) => date.toISOString().slice(0, 10);

/** 'ai_optimized_furnace_control' → 'AI optimized furnace control'. */
export function humanizeOption(key) {
  const text = String(key ?? '')
    .split('_')
    .filter(Boolean)
    .map((word) => ACRONYMS[word] ?? word)
    .join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 'Medium' or ' HIGH ' → 'MEDIUM' / 'HIGH'; unknown values → null. */
export function normalizeLevel(value) {
  const level = String(value ?? '').trim().toUpperCase();
  return LEVEL_SCORES[level] == null ? null : level;
}

const levelScore = (value) => {
  const level = normalizeLevel(value);
  return level ? LEVEL_SCORES[level] : UNKNOWN_LEVEL_SCORE;
};

const validPayback = (years) => (Number.isFinite(years) && years >= 0 ? years : null);

/**
 * The four BR-06 components on a common 0–100 scale:
 * - environmentalImpact: share of factory emissions avoided; FULL_IMPACT_SHARE_PERCENT or more scores 100.
 * - financialBenefit: 100 × (1 − payback / PAYBACK_HORIZON_YEARS); 0 when payback is unavailable (BR-09).
 * - feasibility: mean of the implementation-difficulty and cost-level scores (LOW 100, MEDIUM 60, HIGH 20).
 * - circularity: the knowledge base's circularity score.
 */
export function scoreComponents({ shareOfFactory, paybackYears, difficulty, costLevel, circularityScore }) {
  const share = Number.isFinite(shareOfFactory) ? shareOfFactory : 0;
  const payback = validPayback(paybackYears);
  return {
    environmentalImpact: round(clamp((share / FULL_IMPACT_SHARE_PERCENT) * 100), 2),
    financialBenefit: payback == null ? 0 : round(clamp((1 - payback / PAYBACK_HORIZON_YEARS) * 100), 2),
    feasibility: round((levelScore(difficulty) + levelScore(costLevel)) / 2, 2),
    circularity: round(clamp(Number.isFinite(circularityScore) ? circularityScore : 0), 2),
  };
}

/** Weighted BR-06 score on 0–100, rounded to one decimal. */
export function weightedScore(components, weights = SCORE_WEIGHTS) {
  return round(
    Object.entries(weights).reduce((sum, [component, weight]) => sum + weight * components[component], 0),
    1
  );
}

/** Notes for inputs the knowledge base leaves unspecified (BR-11). */
export function alternativeAssumptions(alternative) {
  const notes = [];
  if (validPayback(alternative.estimated_payback_years) == null) {
    notes.push('Payback is not available (N/A), so the financial benefit scores 0 (BR-09).');
  }
  if (!normalizeLevel(alternative.implementation_difficulty)) {
    notes.push(`Implementation difficulty is not specified, so it is scored as neutral (${UNKNOWN_LEVEL_SCORE}).`);
  }
  if (!normalizeLevel(alternative.cost_level)) {
    notes.push(`Cost level is not specified, so it is scored as neutral (${UNKNOWN_LEVEL_SCORE}).`);
  }
  if (!Number.isFinite(alternative.circularity_score)) notes.push('Circularity score is not specified, so it scores 0.');
  return notes;
}

/** Highest score first; ties by larger savings, then alternative and process name. */
export function rankCandidates(candidates) {
  return [...candidates].sort(
    (a, b) =>
      b.score - a.score ||
      b.estimatedSavings - a.estimatedSavings ||
      a.alternative.localeCompare(b.alternative) ||
      String(a.process ?? '').localeCompare(String(b.process ?? ''))
  );
}

function buildReason({ alternative, target, lead, targeted, savings, reductionPercent, shareOfFactory }) {
  const source = target.activityTypes.map((type) => ACTIVITY_TYPES[type]?.label ?? type).join(' and ');
  const { hotspot } = lead;
  const hotspotNote = hotspot ? ` (hotspot #${hotspot.rank}, ${hotspot.percentage}% of factory emissions, ${hotspot.severity})` : '';
  const where =
    target.scope === 'PROCESS'
      ? `${source} emissions in ${lead.name}${hotspotNote} total ${formatTonnes(targeted)} tCO2e a year.`
      : `${source} emissions total ${formatTonnes(targeted)} tCO2e a year across the factory, mostly from ${lead.name}${hotspotNote}.`;
  return (
    `${where} ${humanizeOption(alternative.alternative_option)} is estimated to cut them by ${reductionPercent}%, ` +
    `avoiding about ${formatTonnes(savings)} tCO2e a year (${shareOfFactory}% of factory emissions).`
  );
}

/**
 * Matches knowledge-base alternatives to a factory's recorded emissions and scores each candidate.
 * Pure and deterministic. `activities` carry their latest stored emission as `emissions[0]`;
 * `factoryEmission` is the factory total (tCO2e) over the same window; `hotspots` come from the
 * hotspot engine and only enrich the explanation.
 */
export function buildCandidates({ activities, processes, alternatives, factoryEmission, hotspots = [] }) {
  const emissionsByProcess = new Map();
  for (const activity of activities) {
    const tonnes = toTonnes(activity.emissions?.[0]);
    if (tonnes == null) continue;
    if (!emissionsByProcess.has(activity.process_id)) emissionsByProcess.set(activity.process_id, new Map());
    const byType = emissionsByProcess.get(activity.process_id);
    byType.set(activity.energy_type, (byType.get(activity.energy_type) ?? 0) + tonnes);
  }
  const names = new Map(processes.map((process) => [process.id, process.name]));
  const hotspotByProcess = new Map(hotspots.map((hotspot) => [hotspot.processId, hotspot]));
  const nameOf = (processId) => names.get(processId) ?? `Process #${processId}`;
  const targetedIn = (processId, types) =>
    types.reduce((sum, type) => sum + (emissionsByProcess.get(processId)?.get(type) ?? 0), 0);

  const candidates = [];
  const unmatchedAlternatives = [];
  for (const alternative of [...alternatives].sort((a, b) => a.id - b.id)) {
    const target = INTERVENTION_TARGETS[alternative.current_option];
    if (!target) {
      unmatchedAlternatives.push(alternative);
      continue;
    }
    const reductionPercent = Number.isFinite(alternative.reduction_percent) ? clamp(alternative.reduction_percent) : 0;
    const scopes =
      target.scope === 'PROCESS'
        ? processes.filter((process) => target.processPattern.test(process.name)).map((process) => process.id)
        : [null];

    for (const processId of scopes) {
      const contributors = (processId == null ? [...emissionsByProcess.keys()] : [processId])
        .map((id) => ({ id, name: nameOf(id), emission: targetedIn(id, target.activityTypes), hotspot: hotspotByProcess.get(id) }))
        .filter((contributor) => contributor.emission > 0)
        .sort((a, b) => b.emission - a.emission || a.name.localeCompare(b.name));
      const targeted = contributors.reduce((sum, contributor) => sum + contributor.emission, 0);
      if (!(targeted > 0) || reductionPercent === 0) continue;

      const savings = (targeted * reductionPercent) / 100;
      const shareOfFactory = percentOf(savings, factoryEmission);
      const components = scoreComponents({
        shareOfFactory,
        paybackYears: alternative.estimated_payback_years,
        difficulty: alternative.implementation_difficulty,
        costLevel: alternative.cost_level,
        circularityScore: alternative.circularity_score,
      });
      candidates.push({
        alternativeId: alternative.id,
        alternative: humanizeOption(alternative.alternative_option),
        scope: target.scope,
        processId,
        process: processId == null ? null : nameOf(processId),
        targetedEmission: round(targeted),
        reductionPercent,
        estimatedSavings: round(savings),
        shareOfFactory,
        paybackYears: validPayback(alternative.estimated_payback_years),
        components,
        score: weightedScore(components),
        reason: buildReason({ alternative, target, lead: contributors[0], targeted, savings, reductionPercent, shareOfFactory }),
      });
    }
  }
  return { candidates: rankCandidates(candidates), unmatchedAlternatives };
}

/** API view of a stored recommendation. The breakdown is recomputed from the stored inputs. */
export function toRecommendationDto(row, rank) {
  const { alternative } = row;
  return {
    id: row.id,
    rank,
    status: row.status,
    alternativeId: alternative.id,
    alternative: humanizeOption(alternative.alternative_option),
    currentOption: humanizeOption(alternative.current_option),
    category: alternative.category,
    description: alternative.description,
    scope: row.process_id == null ? 'FACTORY' : 'PROCESS',
    processId: row.process_id,
    process: row.process?.name ?? null,
    score: row.score,
    scoreBreakdown: scoreComponents({
      shareOfFactory: row.estimated_reduction,
      paybackYears: row.payback_period,
      difficulty: alternative.implementation_difficulty,
      costLevel: alternative.cost_level,
      circularityScore: alternative.circularity_score,
    }),
    // Share of the factory's emissions the intervention is estimated to avoid.
    estimatedReduction: row.estimated_reduction,
    // Knowledge-base reduction of the emissions the intervention targets.
    reductionPercent: alternative.reduction_percent,
    // Estimated CO2e avoided per year.
    estimatedSavings: row.estimated_savings,
    savingsUnit: `${REPORTING_CO2E_UNIT}/yr`,
    estimatedCost: normalizeLevel(alternative.cost_level),
    implementationDifficulty: normalizeLevel(alternative.implementation_difficulty),
    paybackPeriod: row.payback_period,
    circularityScore: alternative.circularity_score,
    reason: row.reason,
    assumptions: alternativeAssumptions(alternative),
    createdAt: row.created_at.toISOString(),
  };
}

const compareRows = (a, b) =>
  (b.score ?? 0) - (a.score ?? 0) ||
  (b.estimated_savings ?? 0) - (a.estimated_savings ?? 0) ||
  humanizeOption(a.alternative.alternative_option).localeCompare(humanizeOption(b.alternative.alternative_option)) ||
  (a.process?.name ?? '').localeCompare(b.process?.name ?? '') ||
  a.id - b.id;

const toRankedDtos = (rows) => [...rows].sort(compareRows).map((row, index) => toRecommendationDto(row, index + 1));

const candidateKey = (alternativeId, processId) => `${alternativeId}|${processId ?? ''}`;

/** Stored recommendations of an authorized factory, ranked by score. Optional status filter. */
export async function listRecommendations(factory, { status } = {}) {
  const rows = await prisma.recommendation.findMany({
    where: { factory_id: factory.id, ...(status ? { status } : {}) },
    include: RECOMMENDATION_INCLUDE,
  });
  const generatedAt = rows.reduce((latest, row) => (latest && latest > row.created_at ? latest : row.created_at), null);
  return {
    factory: { id: factory.id, name: factory.name },
    generatedAt: generatedAt ? generatedAt.toISOString() : null,
    weights: SCORE_WEIGHTS,
    assumptions: GENERAL_ASSUMPTIONS,
    recommendations: toRankedDtos(rows),
  };
}

/**
 * Scores every matching alternative against the factory's trailing 12 months of emissions and
 * stores the result. PENDING recommendations are replaced; ones a person already accepted,
 * rejected or implemented are kept and never duplicated.
 */
export async function generateRecommendations(factory, now = new Date()) {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - (BASELINE_DAYS - 1) * DAY_MS);
  const [{ activities, processes }, alternatives] = await Promise.all([
    loadFactoryActivities(factory, { from, to }),
    prisma.circularAlternative.findMany({ orderBy: { id: 'asc' } }),
  ]);
  const summary = summarizeEmissions({ activities, processes });
  const { hotspots } = rankHotspots(
    summary.byProcess.map(({ processId, process, co2e, activityCount }) => ({ processId, process, emission: co2e, activityCount }))
  );
  const { candidates, unmatchedAlternatives } = buildCandidates({
    activities,
    processes,
    alternatives,
    factoryEmission: summary.totals.co2e,
    hotspots,
  });

  const { rows, created, kept } = await prisma.$transaction(async (tx) => {
    const decided = await tx.recommendation.findMany({
      where: { factory_id: factory.id, status: { not: RECOMMENDATION_STATUSES.PENDING } },
      select: { alternative_id: true, process_id: true },
    });
    const decidedKeys = new Set(decided.map((row) => candidateKey(row.alternative_id, row.process_id)));
    const fresh = candidates.filter((candidate) => !decidedKeys.has(candidateKey(candidate.alternativeId, candidate.processId)));

    await tx.recommendation.deleteMany({ where: { factory_id: factory.id, status: RECOMMENDATION_STATUSES.PENDING } });
    if (fresh.length > 0) {
      await tx.recommendation.createMany({
        data: fresh.map((candidate) => ({
          factory_id: factory.id,
          process_id: candidate.processId,
          alternative_id: candidate.alternativeId,
          score: candidate.score,
          estimated_reduction: candidate.shareOfFactory,
          estimated_savings: candidate.estimatedSavings,
          payback_period: candidate.paybackYears,
          reason: candidate.reason,
          status: RECOMMENDATION_STATUSES.PENDING,
        })),
      });
    }
    const stored = await tx.recommendation.findMany({ where: { factory_id: factory.id }, include: RECOMMENDATION_INCLUDE });
    return { rows: stored, created: fresh.length, kept: decided.length };
  });

  const warnings = summary.warnings.filter((warning) => EMISSION_WARNINGS.has(warning.code));
  if (summary.totals.co2e === 0) {
    warnings.push({
      code: 'NO_EMISSIONS',
      message: 'No emissions were recorded in the last 12 months, so there is nothing to recommend yet.',
    });
  }

  return {
    factory: { id: factory.id, name: factory.name },
    basis: { from: toDateOnly(from), to: toDateOnly(to), factoryEmission: summary.totals.co2e, co2eUnit: summary.co2eUnit },
    weights: SCORE_WEIGHTS,
    assumptions: GENERAL_ASSUMPTIONS,
    created,
    keptDecided: kept,
    unmatchedAlternatives: unmatchedAlternatives.map((alternative) => ({
      id: alternative.id,
      alternative: humanizeOption(alternative.alternative_option),
      currentOption: humanizeOption(alternative.current_option),
      category: alternative.category,
    })),
    recommendations: toRankedDtos(rows),
    warnings,
  };
}
