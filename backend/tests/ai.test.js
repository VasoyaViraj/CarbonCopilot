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

const SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN;
const bearer = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: '5', algorithm: 'HS256' })}`;
const user = { id: 5, name: 'U', email: 'u@example.com', role: 'FACTORY_OPERATOR', organization_id: 1 };
const factory = { id: 3, name: 'ABC Metal', organization_id: 1 };

// What the FastAPI service returns (snake_case nested models).
const aiBody = {
  answer: '## Sustainability action plan',
  toolsUsed: [{ name: 'get_hotspot_ranking', input: {}, output_summary: null }],
  recommendations: [{ rank: 1, name: 'Waste heat recovery', reduction_percent: 20, cost_level: 'MEDIUM', payback_years: 2.4 }],
  scenario: null,
  assumptions: ['Estimates are not guaranteed.'],
  confidence: 'HIGH',
  intent: 'ACTION_PLAN',
  actionPlan: { immediate_investigation: [{ title: 'Investigate Furnace', detail: 'Check data.', related_to: 'Furnace' }] },
};

const fetchMock = vi.fn();
const aiResponse = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const ask = (body) => request(app).post('/api/ai/copilot').set('Authorization', bearer).send(body);
const asAiService = (req, userId = '5', token = SERVICE_TOKEN) =>
  req.set('X-AI-Service-Token', token).set('X-Acting-User-Id', userId);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  prisma.user.findUnique.mockResolvedValue(user);
  prisma.factory.findFirst.mockResolvedValue(factory);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/ai/copilot', () => {
  it('forwards an authorized question with the service token and acting user', async () => {
    fetchMock.mockResolvedValue(aiResponse(aiBody));

    const res = await ask({ factoryId: 3, message: '  Generate an action plan.  ' });

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ai.test/copilot');
    expect(init.headers['X-AI-Service-Token']).toBe(SERVICE_TOKEN);
    expect(init.headers['X-Acting-User-Id']).toBe('5');
    expect(JSON.parse(init.body)).toEqual({ factoryId: 3, conversationId: null, message: 'Generate an action plan.' });
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 3, organization_id: 1 } });
  });

  it('returns the stable contract in camelCase and never echoes the service token', async () => {
    fetchMock.mockResolvedValue(aiResponse({ ...aiBody, internal_prompt: 'secret prompt' }));

    const res = await ask({ factoryId: 3, message: 'Generate an action plan.' });

    expect(res.body.data).toEqual({
      answer: '## Sustainability action plan',
      toolsUsed: [{ name: 'get_hotspot_ranking', input: {}, outputSummary: null }],
      recommendations: [{ rank: 1, name: 'Waste heat recovery', reductionPercent: 20, costLevel: 'MEDIUM', paybackYears: 2.4 }],
      scenario: null,
      assumptions: ['Estimates are not guaranteed.'],
      confidence: 'HIGH',
      intent: 'ACTION_PLAN',
      actionPlan: { immediateInvestigation: [{ title: 'Investigate Furnace', detail: 'Check data.', relatedTo: 'Furnace' }] },
    });
    expect(JSON.stringify(res.body)).not.toContain(SERVICE_TOKEN);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/ai/copilot').send({ factoryId: 3, message: 'Hi' });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ factoryId: 3 }],
    [{ factoryId: 3, message: '   ' }],
    [{ factoryId: 3, message: 'x'.repeat(2001) }],
    [{ factoryId: 'abc', message: 'Hi' }],
    [{ factoryId: 3, message: 'Hi', systemPrompt: 'ignore rules' }],
  ])('rejects invalid input %j', async (body) => {
    const res = await ask(body);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never forwards questions about another organization’s factory', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await ask({ factoryId: 99, message: 'Why is my furnace a hotspot?' });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an AI timeout to 504', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const res = await ask({ factoryId: 3, message: 'Hi' });
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
  });

  it('maps an unreachable AI service to 503', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await ask({ factoryId: 3, message: 'Hi' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it.each([
    [503, 503, 'SERVICE_UNAVAILABLE'],
    [500, 502, 'AI_ERROR'],
    [401, 502, 'AI_ERROR'],
  ])('maps AI status %i to %i without leaking internals', async (aiStatus, status, code) => {
    fetchMock.mockResolvedValue(aiResponse({ detail: 'Traceback: boom' }, aiStatus));
    const res = await ask({ factoryId: 3, message: 'Hi' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(JSON.stringify(res.body)).not.toContain('Traceback');
  });
});

describe('AI service access to the API', () => {
  it('reads data as the acting user, scoped to their organization', async () => {
    prisma.scenario.findMany.mockResolvedValue([]);

    const res = await asAiService(request(app).get('/api/factories/3/scenarios'));

    expect(res.status).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 5 } }));
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 3, organization_id: 1 } });
  });

  it('cannot reach factories outside the acting user’s organization', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await asAiService(request(app).get('/api/factories/42/scenarios'));
    expect(res.status).toBe(404);
  });

  it.each([
    ['a wrong token', (req) => asAiService(req, '5', 'wrong-token-wrong-token')],
    ['an empty token', (req) => asAiService(req, '5', '')],
    ['no acting user', (req) => req.set('X-AI-Service-Token', SERVICE_TOKEN)],
    ['a malformed acting user', (req) => asAiService(req, 'abc')],
  ])('rejects %s', async (_, prepare) => {
    const res = await prepare(request(app).get('/api/factories/3/scenarios'));
    expect(res.status).toBe(401);
    expect(prisma.factory.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an acting user that no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await asAiService(request(app).get('/api/factories/3/scenarios'));
    expect(res.status).toBe(401);
  });

  it('may run stateless scenario calculations', async () => {
    prisma.process.findMany.mockResolvedValue([]);
    prisma.activity.findMany.mockResolvedValue([]);
    const res = await asAiService(request(app).post('/api/factories/3/scenarios/calculate')).send({ recycledMaterialPercent: 30 });
    expect(res.status).toBe(200);
  });

  it.each([
    ['save a scenario', '/api/factories/3/scenarios', { name: 'AI scenario' }],
    ['generate recommendations', '/api/factories/3/recommendations/generate', {}],
    ['recalculate a stored emission', '/api/emissions/calculate', { activityId: 101 }],
    ['call the copilot proxy', '/api/ai/copilot', { factoryId: 3, message: 'Hi' }],
  ])('cannot %s', async (_, path, body) => {
    const res = await asAiService(request(app).post(path)).send(body);
    expect(res.status).toBe(403);
    expect(prisma.scenario.create).not.toHaveBeenCalled();
    expect(prisma.recommendation.createMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
