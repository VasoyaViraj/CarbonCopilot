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

const bearer = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: '5', algorithm: 'HS256' })}`;
const get = (path) => request(app).get(path).set('Authorization', bearer);
const post = (path, body) => request(app).post(path).set('Authorization', bearer).send(body);

const factory = { id: 3, name: 'ABC Metal', organization_id: 1, industry_type: 'Metal Components' };
const asUser = (role = 'FACTORY_OPERATOR') =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: 1 });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  asUser();
  prisma.factory.findFirst.mockResolvedValue(factory);
  prisma.process.findMany.mockResolvedValue([]);
  prisma.activity.findMany.mockResolvedValue([]);
  prisma.recommendation.findMany.mockResolvedValue([]);
  prisma.scenario.findMany.mockResolvedValue([]);
  prisma.aiConversation.findFirst.mockResolvedValue(null);
  prisma.$transaction.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/factories/:id/report', () => {
  it('only includes the factory’s own saved scenarios', async () => {
    const res = await get('/api/factories/3/report');

    expect(res.status).toBe(200);
    expect(prisma.scenario.findMany).toHaveBeenCalled();
    for (const [args] of prisma.scenario.findMany.mock.calls) {
      expect(args.where.factory_id).toBe(3);
    }
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 3, organization_id: 1 } });
  });

  it.each(['3abc', '0', '-1'])('rejects the malformed factory id %s', async (id) => {
    const res = await get(`/api/factories/${id}/report`);
    expect(res.status).toBe(400);
    expect(prisma.factory.findFirst).not.toHaveBeenCalled();
  });

  it('hides factories of other organizations', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    expect((await get('/api/factories/99/report')).status).toBe(404);
  });
});

describe('GET /api/factories/:id/ai/history', () => {
  it('returns only the caller’s own conversation about the factory', async () => {
    const res = await get('/api/factories/3/ai/history');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ conversationId: null, messages: [] });
    expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 5, factory_id: 3 } })
    );
  });

  it('rejects malformed factory ids', async () => {
    expect((await get('/api/factories/3abc/ai/history')).status).toBe(400);
    expect(prisma.factory.findFirst).not.toHaveBeenCalled();
  });

  it('hides factories of other organizations', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    expect((await get('/api/factories/99/ai/history')).status).toBe(404);
    expect(prisma.aiConversation.findFirst).not.toHaveBeenCalled();
  });
});

describe('POST /api/ai/copilot conversation ownership', () => {
  const aiAnswer = { ok: true, status: 200, json: async () => ({ answer: 'ok', confidence: 'LOW' }) };

  it('rejects a conversation the caller does not own before calling the AI service', async () => {
    const res = await post('/api/ai/copilot', { factoryId: 3, message: 'Hi', conversationId: 77 });

    expect(res.status).toBe(404);
    expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 77, user_id: 5, factory_id: 3 } })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('continues a conversation the caller owns', async () => {
    prisma.aiConversation.findFirst.mockResolvedValue({ id: 77 });
    fetchMock.mockResolvedValue(aiAnswer);

    const res = await post('/api/ai/copilot', { factoryId: 3, message: 'Hi', conversationId: 77 });

    expect(res.status).toBe(200);
    expect(res.body.data.conversationId).toBe(77);
    expect(prisma.aiConversation.create).not.toHaveBeenCalled();
  });

  it('starts a new conversation when none is given', async () => {
    prisma.aiConversation.create.mockResolvedValue({ id: 12 });
    fetchMock.mockResolvedValue(aiAnswer);

    const res = await post('/api/ai/copilot', { factoryId: 3, message: 'Hi' });

    expect(res.status).toBe(200);
    expect(res.body.data.conversationId).toBe(12);
    expect(prisma.aiConversation.create).toHaveBeenCalledWith({ data: { user_id: 5, factory_id: 3 } });
  });
});

describe('POST /api/factories/:id/scenarios', () => {
  const savedRow = {
    id: 1,
    factory_id: 3,
    name: 'Pilot',
    description: null,
    baseline_emission: 0,
    projected_emission: 0,
    reduction_amount: 0,
    reduction_percent: 0,
    estimated_cost: 0,
    estimated_savings: 0,
    payback_period: null,
    created_at: new Date('2026-09-12T10:00:00Z'),
  };

  it('is read-only for regulators', async () => {
    asUser('REGULATOR');
    const res = await post('/api/factories/3/scenarios', { name: 'Pilot', recycledMaterialPercent: 30 });
    expect(res.status).toBe(403);
    expect(prisma.scenario.create).not.toHaveBeenCalled();
  });

  it('still lets regulators review saved scenarios', async () => {
    asUser('REGULATOR');
    expect((await get('/api/factories/3/scenarios')).status).toBe(200);
  });

  it.each(['ADMIN', 'FACTORY_OPERATOR', 'CONSULTANT'])('lets %s save scenarios', async (role) => {
    asUser(role);
    prisma.scenario.create.mockResolvedValue(savedRow);
    const res = await post('/api/factories/3/scenarios', { name: 'Pilot', recycledMaterialPercent: 30 });
    expect(res.status).toBe(201);
  });
});
