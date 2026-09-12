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

const stored = (data) => ({
  id: 101,
  created_at: new Date('2026-09-12T10:00:00Z'),
  process: { id: 9, name: 'Furnace' },
  ...data,
});

const valid = {
  activityDate: '2026-09-01',
  energyType: 'NATURAL_GAS',
  quantity: 300,
  unit: 'm3',
  productionQuantity: 8,
  productionUnit: 'tonnes',
};

const post = (body, processId = 9) =>
  request(app).post(`/api/processes/${processId}/activities`).set('Authorization', bearer).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
  prisma.process.findFirst.mockResolvedValue({ id: 9, factory_id: 3, name: 'Furnace' });
  prisma.activity.create.mockImplementation(async ({ data }) => stored(data));
});

describe('POST /api/processes/:id/activities', () => {
  it('creates a manual activity with a normalised type, unit and UTC date', async () => {
    const res = await post({ ...valid, energyType: 'Natural gas', unit: 'M3' });

    expect(res.status).toBe(201);
    expect(prisma.process.findFirst).toHaveBeenCalledWith({ where: { id: 9, factory: { organization_id: 1 } } });
    expect(prisma.activity.create.mock.calls[0][0].data).toEqual({
      process_id: 9,
      activity_date: new Date('2026-09-01T00:00:00.000Z'),
      energy_type: 'NATURAL_GAS',
      quantity: 300,
      unit: 'm3',
      production_quantity: 8,
      production_unit: 'tonnes',
      source: 'MANUAL',
    });
    expect(res.body.data).toMatchObject({
      id: 101,
      processId: 9,
      processName: 'Furnace',
      activityDate: '2026-09-01T00:00:00.000Z',
      energyType: 'NATURAL_GAS',
      category: 'FUEL',
      source: 'MANUAL',
      isSimulated: false,
    });
  });

  it('defaults the unit to the canonical unit and flags simulated readings', async () => {
    const res = await post({
      activityDate: '2026-09-01T08:30:00Z',
      energyType: 'ELECTRICITY',
      quantity: 1200.5,
      source: 'SIMULATION',
    });

    expect(res.status).toBe(201);
    const { data } = prisma.activity.create.mock.calls[0][0];
    expect(data).toMatchObject({ unit: 'kWh', source: 'SIMULATION', production_quantity: null, production_unit: null });
    expect(data.activity_date.toISOString()).toBe('2026-09-01T08:30:00.000Z');
    expect(res.body.data.isSimulated).toBe(true);
  });

  it.each([
    ['a negative quantity', { quantity: -5 }, 'quantity'],
    ['a zero quantity', { quantity: 0 }, 'quantity'],
    ['an implausibly large quantity', { quantity: 50_000_000 }, 'quantity'],
    ['a quantity sent as text', { quantity: '300' }, 'quantity'],
    ['an unsupported activity type', { energyType: 'COAL' }, 'energyType'],
    ['a unit that does not match the type', { unit: 'kWh' }, 'unit'],
    ['an impossible calendar date', { activityDate: '2026-02-30' }, 'activityDate'],
    ['a non-ISO date', { activityDate: '01/09/2026' }, 'activityDate'],
    ['a future date', { activityDate: '2099-01-01' }, 'activityDate'],
    ['a CSV source', { source: 'CSV' }, 'source'],
    ['a negative production quantity', { productionQuantity: -1 }, 'productionQuantity'],
    ['an unknown production unit', { productionUnit: 'barrels' }, 'productionUnit'],
    ['a production unit without a quantity', { productionQuantity: null }, 'productionQuantity'],
  ])('rejects %s without writing', async (_label, override, field) => {
    const res = await post({ ...valid, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((detail) => detail.field)).toContain(field);
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it('rejects unknown fields such as a client-supplied factory ID', async () => {
    const res = await post({ ...valid, factoryId: 2 });
    expect(res.status).toBe(400);
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it('reports another organization’s process as NOT_FOUND and writes nothing', async () => {
    prisma.process.findFirst.mockResolvedValue(null);
    const res = await post(valid, 44);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it.each(['CONSULTANT', 'REGULATOR'])('forbids %s from writing operational data', async (role) => {
    asUser(role);
    const res = await post(valid);

    expect(res.status).toBe(403);
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/processes/9/activities').send(valid);
    expect(res.status).toBe(401);
  });
});

describe('activity listing', () => {
  beforeEach(() => {
    prisma.activity.findMany.mockResolvedValue([
      stored({
        process_id: 9,
        activity_date: new Date('2026-09-02T00:00:00Z'),
        energy_type: 'ELECTRICITY',
        quantity: 1200,
        unit: 'kWh',
        production_quantity: null,
        production_unit: null,
        source: 'SIMULATION',
      }),
    ]);
    prisma.activity.count.mockResolvedValue(1);
  });

  it('lists a process’s activities with filters for read-only roles', async () => {
    asUser('REGULATOR');
    const res = await request(app)
      .get('/api/processes/9/activities?from=2026-09-01&to=2026-09-30&source=SIMULATION&limit=10')
      .set('Authorization', bearer);

    expect(res.status).toBe(200);
    const where = {
      process_id: 9,
      source: 'SIMULATION',
      activity_date: { gte: new Date('2026-09-01T00:00:00Z'), lt: new Date('2026-10-01T00:00:00Z') },
    };
    expect(prisma.activity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 10, skip: 0 }));
    expect(prisma.activity.count).toHaveBeenCalledWith({ where });
    expect(res.body.data).toMatchObject({ total: 1, limit: 10, offset: 0 });
    expect(res.body.data.items[0]).toMatchObject({ energyType: 'ELECTRICITY', isSimulated: true, processName: 'Furnace' });
  });

  it('lists every activity of a factory in the caller’s organization', async () => {
    prisma.factory.findFirst.mockResolvedValue({ id: 3, organization_id: 1 });
    const res = await request(app).get('/api/factories/3/activities').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 3, organization_id: 1 } });
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { process: { factory_id: 3 } }, take: 50, skip: 0 })
    );
  });

  it('does not list activities of another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/factories/8/activities').set('Authorization', bearer);

    expect(res.status).toBe(404);
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['limit above the maximum', 'limit=1000'],
    ['a range that ends before it starts', 'from=2026-09-10&to=2026-09-01'],
    ['an unknown activity type', 'energyType=COAL'],
    ['an unknown parameter', 'processId=4'],
  ])('rejects %s', async (_label, query) => {
    const res = await request(app).get(`/api/processes/9/activities?${query}`).set('Authorization', bearer);
    expect(res.status).toBe(400);
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/activities/types', () => {
  it('exposes the supported activity types, canonical units and sources', async () => {
    const res = await request(app).get('/api/activities/types').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.data.types).toContainEqual(
      expect.objectContaining({ key: 'NATURAL_GAS', category: 'FUEL', unit: 'm3' })
    );
    expect(res.body.data.sources).toEqual(['MANUAL', 'CSV', 'SIMULATION']);
  });
});
