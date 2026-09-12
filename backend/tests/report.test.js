import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const bearer = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: '1', algorithm: 'HS256' })}`;
const user = { id: 1, name: 'Owner', email: 'owner@example.com', role: 'FACTORY_OWNER', organization_id: 1 };
const factory = { id: 1, name: 'Test Factory', organization_id: 1, production_unit: 'tonnes' };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(user);
  prisma.factory.findFirst.mockResolvedValue(factory);
  
  // Mocks for report aggregation
  prisma.process.findMany.mockResolvedValue([]);
  prisma.activity.findMany.mockResolvedValue([]);
  prisma.recommendation.findMany.mockResolvedValue([]);
  prisma.circularAlternative.findMany.mockResolvedValue([]);
  prisma.scenario.findMany.mockResolvedValue([]);
});

describe('GET /api/factories/:factoryId/report', () => {
  it('aggregates and returns factory report data', async () => {
    const res = await request(app)
      .get('/api/factories/1/report')
      .set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.body.data.factory.name).toBe('Test Factory');
    expect(res.body.data.emissions).toBeDefined();
    expect(res.body.data.hotspots).toBeDefined();
    expect(res.body.data.recommendations).toBeDefined();
    expect(res.body.data.scenarios).toBeDefined();
    expect(res.body.data.methodology).toBeDefined();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/factories/1/report');
    expect(res.status).toBe(401);
  });

  it('returns 404 if the factory is missing or belongs to another org', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/factories/999/report')
      .set('Authorization', bearer);
    expect(res.status).toBe(404);
  });
});

describe('report content', () => {
  const simulatedReading = {
    id: 1,
    process_id: 1,
    activity_date: new Date('2026-09-01T00:00:00Z'),
    energy_type: 'ELECTRICITY',
    quantity: 1,
    unit: 'kWh',
    production_quantity: null,
    production_unit: null,
    source: 'SIMULATION',
    process: { name: 'Furnace' },
    emissions: [{ co2e_value: 2000, co2e_unit: 'kgCO2e' }],
  };

  it('reports the factory profile as stored', async () => {
    prisma.factory.findFirst.mockResolvedValue({ ...factory, industry_type: 'Metal Components', production_capacity: 10000 });

    const res = await request(app).get('/api/factories/1/report').set('Authorization', bearer);

    expect(res.body.data.factory).toEqual({
      id: 1,
      name: 'Test Factory',
      industry: 'Metal Components',
      location: null,
      productionCapacity: 10000,
      productionUnit: 'tonnes',
    });
    expect(Date.parse(res.body.data.generatedAt)).not.toBeNaN();
  });

  it('labels emissions from simulated readings separately', async () => {
    prisma.process.findMany.mockResolvedValue([{ id: 1, name: 'Furnace', process_type: null, description: null }]);
    prisma.activity.findMany.mockResolvedValue([simulatedReading]);

    const { body } = await request(app).get('/api/factories/1/report').set('Authorization', bearer);

    expect(body.data.emissions.total).toBe(2);
    expect(body.data.emissions.simulatedCo2e).toBe(2);
    expect(body.data.emissions.byDataSource).toEqual([expect.objectContaining({ source: 'SIMULATION', isSimulated: true })]);
    expect(body.data.hotspots[0]).toMatchObject({ process: 'Furnace', emission: 2 });
  });

  it('describes only the methodology the services implement', async () => {
    const { body } = await request(app).get('/api/factories/1/report').set('Authorization', bearer);

    expect(body.data.methodology.join(' ')).toContain('BR-06');
    expect(body.data.assumptions).toEqual(
      expect.arrayContaining([expect.stringContaining('not guaranteed savings'), expect.stringContaining('never modified')])
    );
    expect(JSON.stringify(body.data)).not.toMatch(/median estimates|production levels are assumed/i);
  });
});
