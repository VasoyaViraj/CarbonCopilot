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
const get = (path) => request(app).get(path).set('Authorization', bearer);
const ORDER = [{ circularity_score: 'desc' }, { id: 'asc' }];
const alternative = { id: 1, category: 'material', current_option: 'virgin_aluminum', alternative_option: 'recycled_aluminum' };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role: 'REGULATOR', organization_id: 1 });
  prisma.circularAlternative.findMany.mockResolvedValue([alternative]);
});

describe('GET /api/circular/alternatives', () => {
  it('lists the knowledge base for any authenticated role', async () => {
    const res = await get('/api/circular/alternatives');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ alternatives: [alternative] });
    expect(prisma.circularAlternative.findMany).toHaveBeenCalledWith({ where: {}, orderBy: ORDER });
  });

  it('filters by category', async () => {
    await get('/api/circular/alternatives?category=material');
    expect(prisma.circularAlternative.findMany).toHaveBeenCalledWith({ where: { category: 'material' }, orderBy: ORDER });
  });

  it('matches the current material, waste or energy option to replace', async () => {
    await get('/api/circular/alternatives?material=virgin_aluminum&energy=NATURAL_GAS');
    expect(prisma.circularAlternative.findMany).toHaveBeenCalledWith({
      where: { current_option: { in: ['virgin_aluminum', 'NATURAL_GAS'] } },
      orderBy: ORDER,
    });
  });

  it.each(['processId=7', 'category=', `material=${'x'.repeat(101)}`])('rejects the invalid query %s', async (query) => {
    const res = await get(`/api/circular/alternatives?${query}`);
    expect(res.status).toBe(400);
    expect(prisma.circularAlternative.findMany).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/circular/alternatives')).status).toBe(401);
  });
});
