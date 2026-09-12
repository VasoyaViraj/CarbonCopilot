import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({ current: null }));
vi.mock('../src/db/db.js', async () => {
  const { createPrismaMock } = await import('./helpers/prismaMock.js');
  prismaMock.current = createPrismaMock();
  return { default: prismaMock.current };
});

const { default: app } = await import('../src/app.js');
const { SCORE_WEIGHTS } = await import('../src/config/recommendationScoring.js');
const { buildCandidates, humanizeOption, normalizeLevel, rankCandidates, scoreComponents, weightedScore } = await import(
  '../src/services/recommendation.service.js'
);
const prisma = prismaMock.current;

const processes = [
  { id: 1, name: 'Furnace', process_type: 'THERMAL', description: null },
  { id: 2, name: 'Boiler', process_type: 'THERMAL', description: null },
  { id: 3, name: 'Packaging', process_type: null, description: null },
];

const activity = (id, processId, energyType, kgCo2e) => ({
  id,
  process_id: processId,
  activity_date: new Date('2026-06-01T00:00:00Z'),
  energy_type: energyType,
  quantity: 1,
  unit: 'unit',
  production_quantity: null,
  production_unit: null,
  source: 'MANUAL',
  process: { name: processes.find((process) => process.id === processId).name },
  emissions: kgCo2e == null ? [] : [{ co2e_value: kgCo2e, co2e_unit: 'kgCO2e' }],
});

// Furnace: 100 t virgin aluminium + 20 t natural gas; Boiler: 10 t natural gas → 130 t in total.
const activities = [
  activity(1, 1, 'VIRGIN_ALUMINUM', 100_000),
  activity(2, 1, 'NATURAL_GAS', 20_000),
  activity(3, 2, 'NATURAL_GAS', 10_000),
  activity(4, 1, 'ELECTRICITY', null), // no stored emission: never targeted
];

const alternative = (id, current, alt, reduction, cost, difficulty, payback, circularity, category = 'energy efficiency') => ({
  id,
  category,
  current_option: current,
  alternative_option: alt,
  description: `${alt} description`,
  reduction_percent: reduction,
  cost_level: cost,
  implementation_difficulty: difficulty,
  estimated_payback_years: payback,
  circularity_score: circularity,
});

const alternatives = [
  alternative(1, 'virgin_aluminum', 'recycled_aluminum', 15, 'MEDIUM', 'MEDIUM', 2.5, 90, 'material'),
  alternative(2, 'furnace_exhaust_heat', 'waste_heat_recovery', 12, 'MEDIUM', 'MEDIUM', 2.4, 70),
  alternative(3, 'standard_boiler', 'waste_heat_recovery_boiler', 12, 'High', 'High', 2.4, 91),
  alternative(4, 'natural_gas', 'biogas', 40, 'Medium', 'Medium', 3, 95, 'fuel substitution'),
  alternative(5, 'single_use_packaging', 'reusable_packaging', 3, 'LOW', 'LOW', 1.2, 80, 'reuse'),
  alternative(6, 'grid_electricity', 'rooftop_solar', 10, 'HIGH', 'MEDIUM', 6, 40),
];

describe('scoring components', () => {
  it('uses the BR-06 weights', () => {
    expect(SCORE_WEIGHTS).toEqual({ environmentalImpact: 0.4, financialBenefit: 0.25, feasibility: 0.2, circularity: 0.15 });
    expect(Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
  });

  it.each([
    [0, 0],
    [2.5, 25],
    [10, 100],
    [40, 100],
  ])('scores environmental impact for a %s%% share as %s', (shareOfFactory, expected) => {
    expect(scoreComponents({ shareOfFactory }).environmentalImpact).toBe(expected);
  });

  it.each([
    [0, 100],
    [2.5, 75],
    [10, 0],
    [14, 0],
    [null, 0],
    [-1, 0],
  ])('scores a payback of %s years as %s', (paybackYears, expected) => {
    expect(scoreComponents({ shareOfFactory: 0, paybackYears }).financialBenefit).toBe(expected);
  });

  it('averages difficulty and cost levels case-insensitively, with unknown levels neutral', () => {
    expect(scoreComponents({ difficulty: 'LOW', costLevel: 'low' }).feasibility).toBe(100);
    expect(scoreComponents({ difficulty: 'Medium', costLevel: 'HIGH' }).feasibility).toBe(40);
    expect(scoreComponents({ difficulty: null, costLevel: 'unknown' }).feasibility).toBe(50);
  });

  it('clamps the circularity score to 0–100', () => {
    expect(scoreComponents({ circularityScore: 120 }).circularity).toBe(100);
    expect(scoreComponents({ circularityScore: null }).circularity).toBe(0);
  });

  it('combines components with the weights, rounded to one decimal', () => {
    const components = { environmentalImpact: 100, financialBenefit: 75, feasibility: 60, circularity: 90 };
    // 40 + 18.75 + 12 + 13.5
    expect(weightedScore(components)).toBe(84.3);
    expect(weightedScore(components, { environmentalImpact: 1, financialBenefit: 0, feasibility: 0, circularity: 0 })).toBe(100);
  });

  it('normalises knowledge-base labels', () => {
    expect(normalizeLevel(' medium ')).toBe('MEDIUM');
    expect(normalizeLevel('extreme')).toBeNull();
    expect(humanizeOption('ai_optimized_furnace_control')).toBe('AI optimized furnace control');
    expect(humanizeOption('high_efficiency_motors_vfd')).toBe('High efficiency motors VFD');
  });
});

describe('buildCandidates', () => {
  const hotspots = [{ rank: 1, processId: 1, process: 'Furnace', emission: 120, percentage: 92.31, severity: 'CRITICAL' }];
  const result = buildCandidates({ activities, processes, alternatives, factoryEmission: 130, hotspots });

  it('matches alternatives to recorded emissions and ranks them by weighted score', () => {
    expect(
      result.candidates.map(({ alternativeId, process, scope, targetedEmission, estimatedSavings, shareOfFactory, score }) => ({
        alternativeId,
        process,
        scope,
        targetedEmission,
        estimatedSavings,
        shareOfFactory,
        score,
      }))
    ).toEqual([
      { alternativeId: 1, process: null, scope: 'FACTORY', targetedEmission: 100, estimatedSavings: 15, shareOfFactory: 11.54, score: 84.3 },
      { alternativeId: 4, process: null, scope: 'FACTORY', targetedEmission: 30, estimatedSavings: 12, shareOfFactory: 9.23, score: 80.7 },
      { alternativeId: 2, process: 'Furnace', scope: 'PROCESS', targetedEmission: 20, estimatedSavings: 2.4, shareOfFactory: 1.85, score: 48.9 },
      { alternativeId: 3, process: 'Boiler', scope: 'PROCESS', targetedEmission: 10, estimatedSavings: 1.2, shareOfFactory: 0.92, score: 40.3 },
    ]);
  });

  it('exposes the normalised component scores behind each score', () => {
    expect(result.candidates[1].components).toEqual({ environmentalImpact: 92.3, financialBenefit: 70, feasibility: 60, circularity: 95 });
  });

  it('applies process-scope alternatives only to matching processes', () => {
    const processScoped = result.candidates.filter((candidate) => candidate.scope === 'PROCESS');
    expect(processScoped.map((candidate) => [candidate.alternativeId, candidate.processId])).toEqual([
      [2, 1],
      [3, 2],
    ]);
  });

  it('reports alternatives without a matching rule and skips ones without recorded emissions', () => {
    expect(result.unmatchedAlternatives.map((alt) => alt.id)).toEqual([5]);
    expect(result.candidates.some((candidate) => candidate.alternativeId === 6)).toBe(false);
  });

  it('explains each candidate with the data behind it', () => {
    expect(result.candidates[0].reason).toBe(
      'Virgin aluminium emissions total 100 tCO2e a year across the factory, mostly from Furnace (hotspot #1, 92.31% of factory emissions, CRITICAL). ' +
        'Recycled aluminum is estimated to cut them by 15%, avoiding about 15 tCO2e a year (11.54% of factory emissions).'
    );
    expect(result.candidates[3].reason).toContain('Natural gas emissions in Boiler total 10 tCO2e a year.');
  });

  it('is reproducible regardless of input order', () => {
    const shuffled = buildCandidates({
      activities: [...activities].reverse(),
      processes: [...processes].reverse(),
      alternatives: [...alternatives].reverse(),
      factoryEmission: 130,
      hotspots,
    });
    expect(shuffled).toEqual(result);
  });

  it('recommends nothing without emissions', () => {
    const empty = buildCandidates({ activities: [], processes, alternatives, factoryEmission: 0 });
    expect(empty.candidates).toEqual([]);
  });

  it('breaks score ties by larger savings, then by name', () => {
    const tie = (alternative, estimatedSavings, process = null) => ({ alternative, estimatedSavings, process, score: 50 });
    expect(rankCandidates([tie('B', 1), tie('A', 1), tie('C', 5)]).map((candidate) => candidate.alternative)).toEqual(['C', 'A', 'B']);
  });
});

const bearer = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: '5', algorithm: 'HS256' })}`;
const asUser = (role = 'FACTORY_OPERATOR', organizationId = 1) =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: organizationId });
const generate = (body = {}) => request(app).post('/api/factories/3/recommendations/generate').set('Authorization', bearer).send(body);
const list = (query = '') => request(app).get(`/api/factories/3/recommendations${query}`).set('Authorization', bearer);

let stored;
let decided;
const toStoredRow = (data, index) => ({
  id: index + 1,
  created_at: new Date('2026-09-12T10:00:00Z'),
  ...data,
  alternative: alternatives.find((alt) => alt.id === data.alternative_id),
  process: data.process_id ? { id: data.process_id, name: processes.find((process) => process.id === data.process_id).name } : null,
});

beforeAll(() => {
  vi.useFakeTimers({ now: new Date('2026-09-12T15:30:00Z'), toFake: ['Date'] });
});
afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
  stored = [];
  decided = [];
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  prisma.factory.findFirst.mockResolvedValue({ id: 3, name: 'ABC Metal', organization_id: 1 });
  prisma.process.findMany.mockResolvedValue(processes);
  prisma.activity.findMany.mockResolvedValue(activities);
  prisma.circularAlternative.findMany.mockResolvedValue(alternatives);
  prisma.recommendation.createMany.mockImplementation(async ({ data }) => {
    stored = [...decided, ...data.map((row, index) => toStoredRow(row, decided.length + index))];
    return { count: data.length };
  });
  prisma.recommendation.findMany.mockImplementation(async ({ select }) =>
    select ? decided.map(({ alternative_id, process_id }) => ({ alternative_id, process_id })) : stored
  );
});

describe('POST /api/factories/:id/recommendations/generate', () => {
  it('scores the trailing 12 months, replaces pending recommendations and returns them ranked', async () => {
    asUser('CONSULTANT');
    const res = await generate();

    expect(res.status).toBe(201);
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          process: { factory_id: 3 },
          activity_date: { gte: new Date('2025-09-13T00:00:00Z'), lt: new Date('2026-09-13T00:00:00Z') },
        },
      })
    );
    expect(prisma.recommendation.deleteMany).toHaveBeenCalledWith({ where: { factory_id: 3, status: 'PENDING' } });
    expect(prisma.recommendation.createMany.mock.calls[0][0].data[0]).toEqual({
      factory_id: 3,
      process_id: null,
      alternative_id: 1,
      score: 84.3,
      estimated_reduction: 11.54,
      estimated_savings: 15,
      payback_period: 2.5,
      reason: expect.stringContaining('Recycled aluminum'),
      status: 'PENDING',
    });

    const body = res.body.data;
    expect(body).toMatchObject({
      basis: { from: '2025-09-13', to: '2026-09-12', factoryEmission: 130, co2eUnit: 'tCO2e' },
      weights: SCORE_WEIGHTS,
      created: 4,
      keptDecided: 0,
      unmatchedAlternatives: [{ id: 5, alternative: 'Reusable packaging', currentOption: 'Single use packaging', category: 'reuse' }],
      // The electricity activity has no stored emission, so it is excluded and reported.
      warnings: [{ code: 'MISSING_EMISSIONS', message: '1 activity has no calculated emission and is excluded from the totals.' }],
    });
    expect(body.recommendations.map((rec) => [rec.rank, rec.alternative, rec.process, rec.score])).toEqual([
      [1, 'Recycled aluminum', null, 84.3],
      [2, 'Biogas', null, 80.7],
      [3, 'Waste heat recovery', 'Furnace', 48.9],
      [4, 'Waste heat recovery boiler', 'Boiler', 40.3],
    ]);
    expect(body.recommendations[0]).toMatchObject({
      status: 'PENDING',
      scope: 'FACTORY',
      category: 'material',
      currentOption: 'Virgin aluminum',
      scoreBreakdown: { environmentalImpact: 100, financialBenefit: 75, feasibility: 60, circularity: 90 },
      estimatedReduction: 11.54,
      reductionPercent: 15,
      estimatedSavings: 15,
      savingsUnit: 'tCO2e/yr',
      estimatedCost: 'MEDIUM',
      implementationDifficulty: 'MEDIUM',
      paybackPeriod: 2.5,
      assumptions: [],
    });
    // Knowledge-base labels are normalised ("Medium" → "MEDIUM").
    expect(body.recommendations[1].estimatedCost).toBe('MEDIUM');
  });

  it('keeps recommendations a person already decided on and does not duplicate them', async () => {
    decided = [toStoredRow({ factory_id: 3, process_id: null, alternative_id: 1, score: 84.3, estimated_reduction: 11.54, estimated_savings: 15, payback_period: 2.5, reason: 'r', status: 'ACCEPTED' }, 0)];
    const res = await generate();

    expect(res.status).toBe(201);
    const created = prisma.recommendation.createMany.mock.calls[0][0].data;
    expect(created.map((row) => row.alternative_id)).toEqual([4, 2, 3]);
    expect(res.body.data).toMatchObject({ created: 3, keptDecided: 1 });
    expect(res.body.data.recommendations.find((rec) => rec.alternativeId === 1).status).toBe('ACCEPTED');
  });

  it('reports when there are no emissions to score', async () => {
    prisma.activity.findMany.mockResolvedValue([]);
    const res = await generate();

    expect(res.status).toBe(201);
    expect(prisma.recommendation.createMany).not.toHaveBeenCalled();
    expect(res.body.data).toMatchObject({ created: 0, recommendations: [] });
    expect(res.body.data.warnings.map((warning) => warning.code)).toEqual(['NO_EMISSIONS']);
  });

  it('forbids regulators from generating recommendations', async () => {
    asUser('REGULATOR');
    const res = await generate();

    expect(res.status).toBe(403);
    expect(prisma.recommendation.deleteMany).not.toHaveBeenCalled();
  });

  it('does not disclose another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await generate();

    expect(res.status).toBe(404);
    expect(prisma.recommendation.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects client-supplied inputs', async () => {
    const res = await generate({ weights: { environmentalImpact: 1 } });
    expect(res.status).toBe(400);
    expect(prisma.recommendation.deleteMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/factories/:id/recommendations', () => {
  beforeEach(() => {
    stored = [
      toStoredRow({ factory_id: 3, process_id: 1, alternative_id: 2, score: 48.9, estimated_reduction: 1.85, estimated_savings: 2.4, payback_period: 2.4, reason: 'r2', status: 'PENDING' }, 0),
      toStoredRow({ factory_id: 3, process_id: null, alternative_id: 1, score: 84.3, estimated_reduction: 11.54, estimated_savings: 15, payback_period: 2.5, reason: 'r1', status: 'PENDING' }, 1),
    ];
  });

  it('returns stored recommendations ranked by score to read-only roles', async () => {
    asUser('REGULATOR');
    const res = await list();

    expect(res.status).toBe(200);
    expect(prisma.recommendation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { factory_id: 3 } }));
    expect(res.body.data).toMatchObject({ factory: { id: 3, name: 'ABC Metal' }, generatedAt: '2026-09-12T10:00:00.000Z', weights: SCORE_WEIGHTS });
    expect(res.body.data.recommendations.map((rec) => [rec.rank, rec.alternative, rec.score])).toEqual([
      [1, 'Recycled aluminum', 84.3],
      [2, 'Waste heat recovery', 48.9],
    ]);
    expect(res.body.data.recommendations[1]).toMatchObject({ scope: 'PROCESS', processId: 1, process: 'Furnace' });
  });

  it('filters by status', async () => {
    await list('?status=ACCEPTED');
    expect(prisma.recommendation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { factory_id: 3, status: 'ACCEPTED' } }));
  });

  it('returns an empty list before anything is generated', async () => {
    stored = [];
    const res = await list();
    expect(res.body.data).toMatchObject({ generatedAt: null, recommendations: [] });
  });

  it.each([
    ['an unknown status', '?status=DONE'],
    ['an unknown parameter', '?limit=5'],
  ])('rejects %s', async (_label, query) => {
    const res = await list(query);
    expect(res.status).toBe(400);
  });

  it('does not disclose another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await list();
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/factories/3/recommendations');
    expect(res.status).toBe(401);
  });
});
