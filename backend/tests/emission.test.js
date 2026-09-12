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
const prisma = prismaMock.current;

const bearer = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: '5', algorithm: 'HS256' })}`;
const asUser = (role = 'FACTORY_OPERATOR', organizationId = 1) =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: organizationId });

const METHOD = 'CO2e = activity quantity × emission factor';
const gasFactor = {
  id: 5,
  category: 'FUEL',
  fuel_type: 'NATURAL_GAS',
  unit: 'm3',
  factor: 1.9,
  co2e_unit: 'kgCO2e',
  region: 'GLOBAL-DEMO',
  year: 2026,
  reference: 'Illustrative demo factor',
};
const storedActivity = {
  id: 101,
  process_id: 9,
  activity_date: new Date('2026-09-01T00:00:00Z'),
  energy_type: 'NATURAL_GAS',
  quantity: 300,
  unit: 'm3',
  source: 'MANUAL',
};

const get = (path) => request(app).get(path).set('Authorization', bearer);
const calculate = (body) => request(app).post('/api/emissions/calculate').set('Authorization', bearer).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  prisma.factory.findFirst.mockResolvedValue({ id: 3, name: 'ABC Metal', organization_id: 1 });
  prisma.emissionFactor.findFirst.mockImplementation(async ({ where }) =>
    where.fuel_type === gasFactor.fuel_type && where.unit === gasFactor.unit ? gasFactor : null
  );
});

describe('GET /api/factories/:id/emissions/summary', () => {
  beforeEach(() => {
    prisma.process.findMany.mockResolvedValue([
      { id: 9, name: 'Furnace' },
      { id: 10, name: 'Boiler' },
    ]);
    prisma.activity.findMany.mockResolvedValue([
      {
        ...storedActivity,
        production_quantity: 8,
        production_unit: 'tonnes',
        process: { name: 'Furnace' },
        emissions: [{ co2e_value: 570, co2e_unit: 'kgCO2e' }],
      },
    ]);
  });

  it('returns backend-aggregated dashboard figures to read-only roles', async () => {
    asUser('REGULATOR');
    const res = await get('/api/factories/3/emissions/summary');

    expect(res.status).toBe(200);
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 3, organization_id: 1 } });
    expect(res.body.data).toMatchObject({
      factory: { id: 3, name: 'ABC Metal' },
      filters: { from: null, to: null, source: null, granularity: 'month' },
      co2eUnit: 'tCO2e',
      totals: { co2e: 0.57, activityCount: 1, emissionCount: 1 },
      production: { quantity: 8, unit: 'tonnes' },
      intensity: { value: 0.07125, unit: 'tCO2e/tonne' },
      history: [{ period: '2026-09', co2e: 0.57 }],
    });
    expect(res.body.data.byProcess).toEqual([
      { processId: 9, process: 'Furnace', co2e: 0.57, activityCount: 1, percentage: 100 },
      { processId: 10, process: 'Boiler', co2e: 0, activityCount: 0, percentage: 0 },
    ]);
  });

  it('scopes the aggregation to the factory, date range and source', async () => {
    const res = await get('/api/factories/3/emissions/summary?from=2026-09-01&to=2026-09-30&source=CSV&granularity=day');

    expect(res.status).toBe(200);
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          process: { factory_id: 3 },
          source: 'CSV',
          activity_date: { gte: new Date('2026-09-01T00:00:00Z'), lt: new Date('2026-10-01T00:00:00Z') },
        },
      })
    );
    expect(prisma.process.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { factory_id: 3 } }));
    expect(res.body.data.filters).toEqual({ from: '2026-09-01', to: '2026-09-30', source: 'CSV', granularity: 'day' });
    expect(res.body.data.history).toHaveLength(30);
  });

  it('does not disclose another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await get('/api/factories/8/emissions/summary');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['daily history without a range', 'granularity=day'],
    ['daily history over more than a year', 'granularity=day&from=2025-01-01&to=2026-06-30'],
    ['an unknown granularity', 'granularity=week'],
    ['a range that ends before it starts', 'from=2026-09-10&to=2026-09-01'],
    ['an unknown source', 'source=SENSOR'],
    ['an unknown parameter', 'processId=4'],
  ])('rejects %s', async (_label, query) => {
    const res = await get(`/api/factories/3/emissions/summary?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/factories/3/emissions/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/factories/:id/emissions', () => {
  beforeEach(() => {
    prisma.emission.findMany.mockResolvedValue([
      {
        id: 70,
        activity_id: 101,
        emission_factor_id: 5,
        co2e_value: 570,
        co2e_unit: 'kgCO2e',
        calculation_method: METHOD,
        calculated_at: new Date('2026-09-12T10:00:00Z'),
        activity: { ...storedActivity, process: { id: 9, name: 'Furnace' } },
        emission_factor: gasFactor,
      },
    ]);
    prisma.emission.count.mockResolvedValue(1);
  });

  it('lists stored emissions with the activity and factor that explain them', async () => {
    const res = await get('/api/factories/3/emissions?processId=9&energyType=natural%20gas&limit=10');

    expect(res.status).toBe(200);
    const where = { activity: { process_id: 9, process: { factory_id: 3 }, energy_type: 'NATURAL_GAS' } };
    expect(prisma.emission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 10, skip: 0 }));
    expect(prisma.emission.count).toHaveBeenCalledWith({ where });
    expect(res.body.data).toMatchObject({ total: 1, limit: 10, offset: 0 });
    expect(res.body.data.items[0]).toEqual({
      id: 70,
      co2eValue: 570,
      co2eUnit: 'kgCO2e',
      emissionFactorId: 5,
      calculationMethod: METHOD,
      calculatedAt: '2026-09-12T10:00:00.000Z',
      activityId: 101,
      processId: 9,
      processName: 'Furnace',
      activityDate: '2026-09-01T00:00:00.000Z',
      energyType: 'NATURAL_GAS',
      category: 'FUEL',
      quantity: 300,
      unit: 'm3',
      source: 'MANUAL',
      isSimulated: false,
      factor: { id: 5, value: 1.9, unit: 'kgCO2e/m3', region: 'GLOBAL-DEMO', year: 2026, reference: 'Illustrative demo factor' },
    });
  });

  it('does not list another organization’s emissions', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await get('/api/factories/8/emissions');
    expect(res.status).toBe(404);
    expect(prisma.emission.findMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid process filter', async () => {
    const res = await get('/api/factories/3/emissions?processId=abc');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/emissions/calculate', () => {
  it('calculates an ad-hoc emission for any role without storing it', async () => {
    asUser('CONSULTANT');
    const res = await calculate({ activityType: 'Natural gas', quantity: 300 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      activityType: 'NATURAL_GAS',
      quantity: 300,
      unit: 'm3',
      emissionFactorId: 5,
      factor: 1.9,
      factorUnit: 'kgCO2e/m3',
      co2eValue: 570,
      co2eUnit: 'kgCO2e',
      calculationMethod: METHOD,
    });
    expect(prisma.emission.create).not.toHaveBeenCalled();
  });

  it('accepts a zero quantity', async () => {
    const res = await calculate({ activityType: 'NATURAL_GAS', quantity: 0, unit: 'm3' });
    expect(res.status).toBe(200);
    expect(res.body.data.co2eValue).toBe(0);
  });

  it.each([
    ['both an activity and ad-hoc fields', { activityId: 101, activityType: 'NATURAL_GAS', quantity: 1 }, 'activityId'],
    ['no activity type', { quantity: 300 }, 'activityType'],
    ['an unsupported activity type', { activityType: 'COAL', quantity: 300 }, 'activityType'],
    ['no quantity', { activityType: 'NATURAL_GAS' }, 'quantity'],
    ['a negative quantity', { activityType: 'NATURAL_GAS', quantity: -1 }, 'quantity'],
    ['an implausible quantity', { activityType: 'NATURAL_GAS', quantity: 50_000_000 }, 'quantity'],
    ['an incompatible unit', { activityType: 'NATURAL_GAS', quantity: 300, unit: 'kWh' }, 'unit'],
    ['an unknown field', { activityType: 'NATURAL_GAS', quantity: 300, factoryId: 2 }, ''],
  ])('rejects %s', async (_label, body, field) => {
    const res = await calculate(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((detail) => detail.field)).toContain(field);
  });

  it('reports a missing emission factor as a validation error', async () => {
    prisma.emissionFactor.findFirst.mockResolvedValue(null);
    const res = await calculate({ activityType: 'NATURAL_GAS', quantity: 300 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('No emission factor is configured for NATURAL_GAS in m3');
  });

  describe('for a stored activity', () => {
    beforeEach(() => {
      prisma.activity.findFirst.mockResolvedValue(storedActivity);
      prisma.activity.findUnique.mockResolvedValue(storedActivity);
      prisma.emission.create.mockImplementation(async ({ data }) => ({ id: 71, calculated_at: new Date('2026-09-12T10:00:00Z'), ...data }));
    });

    it('recalculates and replaces the stored emission', async () => {
      const res = await calculate({ activityId: 101 });

      expect(res.status).toBe(200);
      expect(prisma.activity.findFirst).toHaveBeenCalledWith({
        where: { id: 101, process: { factory: { organization_id: 1 } } },
      });
      expect(prisma.emission.deleteMany).toHaveBeenCalledWith({ where: { activity_id: 101 } });
      expect(prisma.emission.create).toHaveBeenCalledWith({
        data: { activity_id: 101, emission_factor_id: 5, co2e_value: 570, co2e_unit: 'kgCO2e', calculation_method: METHOD },
      });
      expect(res.body.data).toMatchObject({
        activityId: 101,
        emissionFactorId: 5,
        quantity: 300,
        factor: 1.9,
        co2eValue: 570,
        emission: { id: 71, co2eValue: 570, co2eUnit: 'kgCO2e' },
      });
    });

    it('does not disclose another organization’s activity', async () => {
      prisma.activity.findFirst.mockResolvedValue(null);
      const res = await calculate({ activityId: 555 });

      expect(res.status).toBe(404);
      expect(prisma.emission.create).not.toHaveBeenCalled();
    });

    it.each(['CONSULTANT', 'REGULATOR'])('forbids %s from rewriting stored emissions', async (role) => {
      asUser(role);
      const res = await calculate({ activityId: 101 });

      expect(res.status).toBe(403);
      expect(prisma.emission.deleteMany).not.toHaveBeenCalled();
    });
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/emissions/calculate').send({ activityType: 'NATURAL_GAS', quantity: 1 });
    expect(res.status).toBe(401);
  });
});
