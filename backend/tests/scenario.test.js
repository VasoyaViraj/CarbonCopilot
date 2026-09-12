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
const post = (path, body) => request(app).post(path).set('Authorization', bearer).send(body);
const get = (path) => request(app).get(path).set('Authorization', bearer);

const factory = { id: 3, name: 'ABC Metal', organization_id: 1 };
const processes = [
  { id: 1, name: 'Furnace', process_type: 'THERMAL', description: null },
  { id: 2, name: 'Packaging', process_type: null, description: null },
];
const activity = (id, processId, energyType, kgCo2e) => ({
  id,
  process_id: processId,
  activity_date: new Date('2026-09-01T00:00:00Z'),
  energy_type: energyType,
  quantity: 1,
  unit: 'unit',
  production_quantity: null,
  production_unit: null,
  source: 'MANUAL',
  process: { name: processes.find((process) => process.id === processId).name },
  emissions: [{ co2e_value: kgCo2e, co2e_unit: 'kgCO2e' }],
});
const activities = [
  activity(1, 1, 'VIRGIN_ALUMINUM', 100_000),
  activity(2, 1, 'ELECTRICITY', 50_000),
  activity(3, 1, 'NATURAL_GAS', 30_000),
  activity(4, 2, 'WASTE_LANDFILL', 20_000),
];
const scenarioInput = {
  recycledMaterialPercent: 10,
  energyEfficiencyPercent: 20,
  fuelReplacementPercent: 50,
  wasteRecoveryPercent: 25,
};

const asUser = (role = 'FACTORY_OPERATOR', organizationId = 1) =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: organizationId });

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
  prisma.factory.findFirst.mockResolvedValue(factory);
  prisma.process.findMany.mockResolvedValue(processes);
  prisma.activity.findMany.mockResolvedValue(activities);
});

describe('POST /api/factories/:id/scenarios/calculate', () => {
  it('calculates projected emissions, reduction, savings and payback deterministically', async () => {
    const res = await post('/api/factories/3/scenarios/calculate', scenarioInput);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      baselineEmission: 200,
      projectedEmission: 160,
      reductionAmount: 40,
      reductionPercent: 20,
      estimatedCost: 525_000,
      estimatedSavings: 2_000,
      paybackPeriod: 262.5,
      unit: 'tCO2e',
    });
    expect(res.body.data.assumptions).toEqual(expect.arrayContaining([expect.stringContaining('never modified')]));
  });

  it('does not mutate activities, emissions, or stored scenarios during calculation', async () => {
    await post('/api/factories/3/scenarios/calculate', scenarioInput);

    expect(prisma.activity.create).not.toHaveBeenCalled();
    expect(prisma.activity.update).not.toHaveBeenCalled();
    expect(prisma.activity.delete).not.toHaveBeenCalled();
    expect(prisma.emission.create).not.toHaveBeenCalled();
    expect(prisma.emission.deleteMany).not.toHaveBeenCalled();
    expect(prisma.scenario.create).not.toHaveBeenCalled();
  });

  it('avoids division by zero and returns N/A payback as null when baseline savings are zero', async () => {
    prisma.activity.findMany.mockResolvedValue([]);
    const res = await post('/api/factories/3/scenarios/calculate', scenarioInput);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      baselineEmission: 0,
      projectedEmission: 0,
      reductionAmount: 0,
      reductionPercent: 0,
      estimatedCost: 525_000,
      estimatedSavings: 0,
      paybackPeriod: null,
    });
  });

  it.each([
    ['negative percentages', { ...scenarioInput, energyEfficiencyPercent: -1 }],
    ['percentages above 100', { ...scenarioInput, wasteRecoveryPercent: 101 }],
    ['unknown fields', { ...scenarioInput, extra: 1 }],
  ])('rejects %s', async (_label, body) => {
    const res = await post('/api/factories/3/scenarios/calculate', body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it('does not disclose another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await post('/api/factories/8/scenarios/calculate', scenarioInput);

    expect(res.status).toBe(404);
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/factories/3/scenarios/calculate').send(scenarioInput);
    expect(res.status).toBe(401);
  });
});

describe('stored scenario endpoints', () => {
  const storedScenario = {
    id: 9,
    factory_id: 3,
    name: 'Efficiency bundle',
    description: 'Shift material, energy, fuel and waste levers.',
    baseline_emission: 200,
    projected_emission: 160,
    reduction_amount: 40,
    reduction_percent: 20,
    estimated_cost: 525_000,
    estimated_savings: 2_000,
    payback_period: 262.5,
    created_at: new Date('2026-09-12T10:00:00Z'),
  };

  it('saves a scenario snapshot without changing baseline records', async () => {
    prisma.scenario.create.mockResolvedValue(storedScenario);
    const res = await post('/api/factories/3/scenarios', {
      ...scenarioInput,
      name: 'Efficiency bundle',
      description: 'Shift material, energy, fuel and waste levers.',
    });

    expect(res.status).toBe(201);
    expect(prisma.scenario.create).toHaveBeenCalledWith({
      data: {
        factory_id: 3,
        name: 'Efficiency bundle',
        description: 'Shift material, energy, fuel and waste levers.',
        baseline_emission: 200,
        projected_emission: 160,
        reduction_amount: 40,
        reduction_percent: 20,
        estimated_cost: 525_000,
        estimated_savings: 2_000,
        payback_period: 262.5,
      },
    });
    expect(prisma.emission.deleteMany).not.toHaveBeenCalled();
    expect(res.body.data).toMatchObject({
      id: 9,
      factoryId: 3,
      name: 'Efficiency bundle',
      baselineEmission: 200,
      projectedEmission: 160,
      reductionAmount: 40,
      reductionPercent: 20,
      estimatedCost: 525_000,
      estimatedSavings: 2_000,
      paybackPeriod: 262.5,
      unit: 'tCO2e',
      createdAt: '2026-09-12T10:00:00.000Z',
    });
  });

  it('lists saved scenarios newest first', async () => {
    prisma.scenario.findMany.mockResolvedValue([storedScenario]);
    const res = await get('/api/factories/3/scenarios');

    expect(res.status).toBe(200);
    expect(prisma.scenario.findMany).toHaveBeenCalledWith({ where: { factory_id: 3 }, orderBy: { created_at: 'desc' } });
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 9,
        factoryId: 3,
        name: 'Efficiency bundle',
        projectedEmission: 160,
        createdAt: '2026-09-12T10:00:00.000Z',
      }),
    ]);
  });

  it('validates scenario save metadata', async () => {
    const res = await post('/api/factories/3/scenarios', { ...scenarioInput, name: '' });

    expect(res.status).toBe(400);
    expect(prisma.scenario.create).not.toHaveBeenCalled();
  });
});
