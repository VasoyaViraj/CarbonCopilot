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
