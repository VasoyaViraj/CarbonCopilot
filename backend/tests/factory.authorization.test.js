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
const asUser = (role, organizationId = 1) =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: organizationId });

const writes = [
  ['create a factory', (api) => api.post('/api/factories').send({ name: 'Plant' })],
  ['update a factory', (api) => api.put('/api/factories/3').send({ name: 'Plant 2' })],
  ['delete a factory', (api) => api.delete('/api/factories/3')],
  ['add a process', (api) => api.post('/api/factories/3/processes').send({ name: 'Kiln' })],
  ['update a process', (api) => api.put('/api/factories/3/processes/9').send({ name: 'Kiln 2' })],
  ['delete a process', (api) => api.delete('/api/factories/3/processes/9')],
];

const writeMocks = () => [
  prisma.factory.create,
  prisma.factory.update,
  prisma.factory.delete,
  prisma.process.create,
  prisma.process.update,
  prisma.process.delete,
];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.factory.findFirst.mockResolvedValue({ id: 3, organization_id: 1 });
  prisma.factory.findMany.mockResolvedValue([{ id: 3, organization_id: 1 }]);
  prisma.process.findFirst.mockResolvedValue({ id: 9, factory_id: 3, name: 'Kiln' });
  prisma.process.findMany.mockResolvedValue([]);
  for (const mock of writeMocks()) mock.mockImplementation(async ({ data } = {}) => ({ id: 3, ...data }));
});

describe('factory and process writes', () => {
  describe.each(['CONSULTANT', 'REGULATOR'])('as %s', (role) => {
    it.each(writes)('cannot %s', async (_label, send) => {
      asUser(role);
      const res = await send(request(app)).set('Authorization', bearer);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      for (const mock of writeMocks()) expect(mock).not.toHaveBeenCalled();
    });
  });

  describe.each(['FACTORY_OPERATOR', 'ADMIN'])('as %s', (role) => {
    it.each(writes)('can %s', async (_label, send) => {
      asUser(role);
      const res = await send(request(app)).set('Authorization', bearer);
      expect([200, 201]).toContain(res.status);
    });
  });

  it('lets read-only roles view factories and processes', async () => {
    asUser('REGULATOR');
    const factories = await request(app).get('/api/factories').set('Authorization', bearer);
    const processes = await request(app).get('/api/factories/3/processes').set('Authorization', bearer);

    expect(factories.status).toBe(200);
    expect(processes.status).toBe(200);
  });

  it.each([
    ['update', (api) => api.put('/api/factories/3/processes/9').send({ name: 'Moved' })],
    ['delete', (api) => api.delete('/api/factories/3/processes/9')],
  ])('will not %s a process through a different factory of the same organization', async (_label, send) => {
    asUser('FACTORY_OPERATOR');
    prisma.process.findFirst.mockResolvedValue({ id: 9, factory_id: 4, name: 'Other plant kiln' });
    const res = await send(request(app)).set('Authorization', bearer);

    expect(res.status).toBe(404);
    expect(prisma.process.update).not.toHaveBeenCalled();
    expect(prisma.process.delete).not.toHaveBeenCalled();
  });
});
