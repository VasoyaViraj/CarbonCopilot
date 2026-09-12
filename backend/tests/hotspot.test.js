import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({ current: null }));
vi.mock('../src/db/db.js', async () => {
  const { createPrismaMock } = await import('./helpers/prismaMock.js');
  prismaMock.current = createPrismaMock();
  return { default: prismaMock.current };
});

const { default: app } = await import('../src/app.js');
const { HOTSPOT_THRESHOLDS, classifySeverity, rankHotspots } = await import('../src/services/hotspot.service.js');
const prisma = prismaMock.current;

// Reference dataset from the test plan (tCO2e).
const planProcesses = [
  ['Furnace', 520],
  ['Electricity', 250],
  ['Boiler', 180],
  ['Transport', 80],
  ['Waste', 70],
].map(([process, emission], index) => ({ processId: index + 1, process, emission }));

describe('classifySeverity', () => {
  it('uses the default BR-04 thresholds', () => {
    expect(HOTSPOT_THRESHOLDS).toEqual({ critical: 40, high: 25, medium: 10 });
  });

  it.each([
    [100, 'CRITICAL'],
    [40.01, 'CRITICAL'],
    [40, 'HIGH'],
    [25, 'HIGH'],
    [24.99, 'MEDIUM'],
    [10, 'MEDIUM'],
    [9.99, 'LOW'],
    [0, 'LOW'],
  ])('classifies %s%% as %s', (percentage, severity) => {
    expect(classifySeverity(percentage)).toBe(severity);
  });

  it('honours configured thresholds', () => {
    const strict = { critical: 30, high: 15, medium: 5 };
    expect(classifySeverity(35, strict)).toBe('CRITICAL');
    expect(classifySeverity(20, strict)).toBe('HIGH');
    expect(classifySeverity(5, strict)).toBe('MEDIUM');
    expect(classifySeverity(4.9, strict)).toBe('LOW');
  });
});

describe('rankHotspots', () => {
  it('ranks the test-plan dataset by contribution with severities', () => {
    const { totalEmission, hotspots } = rankHotspots(planProcesses);

    expect(totalEmission).toBe(1100);
    expect(hotspots).toEqual([
      { rank: 1, processId: 1, process: 'Furnace', emission: 520, percentage: 47.27, severity: 'CRITICAL', activityCount: 0 },
      { rank: 2, processId: 2, process: 'Electricity', emission: 250, percentage: 22.73, severity: 'MEDIUM', activityCount: 0 },
      { rank: 3, processId: 3, process: 'Boiler', emission: 180, percentage: 16.36, severity: 'MEDIUM', activityCount: 0 },
      { rank: 4, processId: 4, process: 'Transport', emission: 80, percentage: 7.27, severity: 'LOW', activityCount: 0 },
      { rank: 5, processId: 5, process: 'Waste', emission: 70, percentage: 6.36, severity: 'LOW', activityCount: 0 },
    ]);
  });

  it('is independent of input order and does not mutate its input', () => {
    const shuffled = [planProcesses[3], planProcesses[0], planProcesses[4], planProcesses[2], planProcesses[1]];
    const snapshot = structuredClone(shuffled);

    expect(rankHotspots(shuffled)).toEqual(rankHotspots(planProcesses));
    expect(shuffled).toEqual(snapshot);
  });

  it('returns no hotspots when total emissions are zero', () => {
    expect(rankHotspots([{ processId: 1, process: 'Furnace', emission: 0 }])).toEqual({ totalEmission: 0, hotspots: [] });
  });

  it('returns no hotspots for an empty dataset', () => {
    expect(rankHotspots([])).toEqual({ totalEmission: 0, hotspots: [] });
  });

  it('keeps processes without emissions last at 0% and breaks ties by name', () => {
    const { hotspots } = rankHotspots([
      { processId: 3, process: 'Packaging', emission: 0 },
      { processId: 2, process: 'Boiler', emission: 50 },
      { processId: 1, process: 'Assembly', emission: 50 },
    ]);
    expect(hotspots.map(({ process, percentage, severity }) => [process, percentage, severity])).toEqual([
      ['Assembly', 50, 'CRITICAL'],
      ['Boiler', 50, 'CRITICAL'],
      ['Packaging', 0, 'LOW'],
    ]);
  });

  it('treats negative or non-numeric emissions as zero', () => {
    const { totalEmission, hotspots } = rankHotspots([
      { processId: 1, process: 'Furnace', emission: 10 },
      { processId: 2, process: 'Boiler', emission: -5 },
      { processId: 3, process: 'Waste', emission: Number.NaN },
    ]);
    expect(totalEmission).toBe(10);
    expect(hotspots.map((hotspot) => hotspot.emission)).toEqual([10, 0, 0]);
  });

  it('rounds percentages to two decimals', () => {
    const { hotspots } = rankHotspots([
      { processId: 1, process: 'A', emission: 1 },
      { processId: 2, process: 'B', emission: 1 },
      { processId: 3, process: 'C', emission: 1 },
    ]);
    expect(hotspots.map((hotspot) => hotspot.percentage)).toEqual([33.33, 33.33, 33.33]);
    expect(hotspots.every((hotspot) => hotspot.severity === 'HIGH')).toBe(true);
  });

  it('assigns severity from the displayed (rounded) percentage', () => {
    const { hotspots } = rankHotspots([
      { processId: 1, process: 'Furnace', emission: 59.996 },
      { processId: 2, process: 'Boiler', emission: 40.004 },
    ]);
    // 40.004% is shown as 40%, which is HIGH rather than CRITICAL.
    expect(hotspots[1]).toMatchObject({ percentage: 40, severity: 'HIGH' });
  });

  it('applies custom thresholds', () => {
    const { hotspots } = rankHotspots(planProcesses, { critical: 50, high: 20, medium: 8 });
    expect(hotspots.map((hotspot) => hotspot.severity)).toEqual(['HIGH', 'HIGH', 'MEDIUM', 'LOW', 'LOW']);
  });
});

const bearer = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: '5', algorithm: 'HS256' })}`;
const asUser = (role = 'FACTORY_OPERATOR', organizationId = 1) =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: organizationId });
const get = (path) => request(app).get(path).set('Authorization', bearer);

const processes = [
  { id: 9, name: 'Furnace', process_type: 'THERMAL', description: 'Main furnace' },
  { id: 10, name: 'Boiler', process_type: 'THERMAL', description: null },
  { id: 11, name: 'Packaging', process_type: null, description: null },
];
const activity = (id, processId, name, energyType, co2e, extra = {}) => ({
  id,
  process_id: processId,
  activity_date: new Date('2026-09-01T00:00:00Z'),
  energy_type: energyType,
  quantity: 1,
  unit: 'kWh',
  production_quantity: null,
  production_unit: null,
  source: 'MANUAL',
  process: { name },
  emissions: [{ co2e_value: co2e, co2e_unit: 'kgCO2e' }],
  ...extra,
});
const activities = [
  activity(1, 9, 'Furnace', 'NATURAL_GAS', 570, { production_quantity: 10, production_unit: 'tonnes' }),
  activity(2, 9, 'Furnace', 'ELECTRICITY', 700),
  activity(3, 10, 'Boiler', 'DIESEL', 268, { source: 'SIMULATION' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
  prisma.factory.findFirst.mockResolvedValue({ id: 3, name: 'ABC Metal', organization_id: 1 });
  prisma.process.findMany.mockResolvedValue(processes);
  prisma.activity.findMany.mockResolvedValue(activities);
});

describe('GET /api/factories/:id/hotspots', () => {
  it('ranks the factory’s processes for read-only roles', async () => {
    asUser('REGULATOR');
    const res = await get('/api/factories/3/hotspots');

    expect(res.status).toBe(200);
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 3, organization_id: 1 } });
    expect(res.body.data).toMatchObject({
      factory: { id: 3, name: 'ABC Metal' },
      filters: { from: null, to: null, source: null },
      co2eUnit: 'tCO2e',
      totalEmission: 1.538,
      activityCount: 3,
      emissionCount: 3,
      thresholds: { critical: 40, high: 25, medium: 10 },
      warnings: [],
    });
    expect(res.body.data.hotspots).toEqual([
      { rank: 1, processId: 9, process: 'Furnace', emission: 1.27, percentage: 82.57, severity: 'CRITICAL', activityCount: 2 },
      { rank: 2, processId: 10, process: 'Boiler', emission: 0.268, percentage: 17.43, severity: 'MEDIUM', activityCount: 1 },
      { rank: 3, processId: 11, process: 'Packaging', emission: 0, percentage: 0, severity: 'LOW', activityCount: 0 },
    ]);
  });

  it('applies the date range and source filters', async () => {
    const res = await get('/api/factories/3/hotspots?from=2026-09-01&to=2026-09-30&source=MANUAL');

    expect(res.status).toBe(200);
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          process: { factory_id: 3 },
          source: 'MANUAL',
          activity_date: { gte: new Date('2026-09-01T00:00:00Z'), lt: new Date('2026-10-01T00:00:00Z') },
        },
      })
    );
    expect(res.body.data.filters).toEqual({ from: '2026-09-01', to: '2026-09-30', source: 'MANUAL' });
  });

  it('returns an empty ranking when there are no emissions', async () => {
    prisma.activity.findMany.mockResolvedValue([]);
    const res = await get('/api/factories/3/hotspots');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ totalEmission: 0, activityCount: 0, hotspots: [] });
  });

  it('reports activities without a calculated emission', async () => {
    prisma.activity.findMany.mockResolvedValue([...activities, activity(4, 10, 'Boiler', 'LPG', 0, { emissions: [] })]);
    const res = await get('/api/factories/3/hotspots');

    expect(res.body.data.warnings.map((warning) => warning.code)).toEqual(['MISSING_EMISSIONS']);
  });

  it('does not disclose another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await get('/api/factories/8/hotspots');

    expect(res.status).toBe(404);
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['a range that ends before it starts', 'from=2026-09-10&to=2026-09-01'],
    ['an unknown source', 'source=SENSOR'],
    ['an unsupported parameter', 'granularity=month'],
  ])('rejects %s', async (_label, query) => {
    const res = await get(`/api/factories/3/hotspots?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/factories/3/hotspots');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/factories/:id/hotspots/:processId', () => {
  it('explains one process: rank, share and what drives its emissions', async () => {
    const res = await get('/api/factories/3/hotspots/9');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      process: { id: 9, name: 'Furnace', processType: 'THERMAL', description: 'Main furnace' },
      hotspot: { rank: 1, processId: 9, emission: 1.27, percentage: 82.57, severity: 'CRITICAL' },
      factoryTotalEmission: 1.538,
      rankedProcessCount: 3,
      emission: 1.27,
      activityCount: 2,
      history: [{ period: '2026-09', co2e: 1.27 }],
      intensity: { value: 0.127, unit: 'tCO2e/tonne' },
    });
    expect(res.body.data.drivers).toEqual([
      { activityType: 'ELECTRICITY', label: 'Electricity', category: 'ENERGY', co2e: 0.7, percentage: 55.12 },
      { activityType: 'NATURAL_GAS', label: 'Natural gas', category: 'FUEL', co2e: 0.57, percentage: 44.88 },
    ]);
  });

  it('labels simulated emissions within a process', async () => {
    const res = await get('/api/factories/3/hotspots/10');
    expect(res.body.data).toMatchObject({ emission: 0.268, simulatedEmission: 0.268 });
  });

  it('returns a null hotspot for a process in a factory without emissions', async () => {
    prisma.activity.findMany.mockResolvedValue([]);
    const res = await get('/api/factories/3/hotspots/11');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ hotspot: null, emission: 0, drivers: [], rankedProcessCount: 0 });
  });

  it('returns NOT_FOUND for a process outside the factory', async () => {
    const res = await get('/api/factories/3/hotspots/999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Process not found');
  });

  it('rejects a malformed process id', async () => {
    const res = await get('/api/factories/3/hotspots/abc');
    expect(res.status).toBe(400);
  });

  it('does not disclose another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await get('/api/factories/8/hotspots/9');
    expect(res.status).toBe(404);
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });
});
