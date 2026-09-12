import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({ current: null }));
vi.mock('../src/db/db.js', async () => {
  const { createPrismaMock } = await import('./helpers/prismaMock.js');
  prismaMock.current = createPrismaMock();
  return { default: prismaMock.current };
});

const { authenticate, authorize, requireFactoryAccess } = await import('../src/middleware/auth.middleware.js');
const { getAuthorizedProcess } = await import('../src/services/access.service.js');
const { errorHandler } = await import('../src/middleware/error.middleware.js');
const { ROLE_GROUPS } = await import('../src/constants.js');
const prisma = prismaMock.current;

// Minimal app exercising the reusable authorization building blocks.
const app = express();
app.get('/factories/:id', authenticate, requireFactoryAccess('id'), (req, res) => res.json({ id: req.factory.id }));
app.get('/processes/:id', authenticate, async (req, res) => {
  const process = await getAuthorizedProcess(req.user, req.params.id);
  res.json({ id: process.id });
});
app.post('/config', authenticate, authorize(ROLE_GROUPS.MANAGE_CONFIGURATION), (req, res) => res.json({ ok: true }));
app.use(errorHandler);

const bearer = (userId) =>
  `Bearer ${jwt.sign({ role: 'ADMIN' }, process.env.JWT_SECRET, { subject: String(userId), algorithm: 'HS256' })}`;
const asUser = (role, organizationId = 1) =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: organizationId });

beforeEach(() => vi.clearAllMocks());

describe('factory access', () => {
  it('scopes the factory query to the caller organization', async () => {
    asUser('FACTORY_OPERATOR', 1);
    prisma.factory.findFirst.mockResolvedValue({ id: 10, organization_id: 1 });
    const res = await request(app).get('/factories/10').set('Authorization', bearer(5));
    expect(res.status).toBe(200);
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 10, organization_id: 1 } });
  });

  it('reports another organization’s factory as NOT_FOUND', async () => {
    asUser('ADMIN', 1);
    prisma.factory.findFirst.mockResolvedValue(null); // factory 20 exists, but in organization 2
    const res = await request(app).get('/factories/20').set('Authorization', bearer(5));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed IDs before querying', async () => {
    asUser('FACTORY_OPERATOR', 1);
    const res = await request(app).get('/factories/1%20OR%201=1').set('Authorization', bearer(5));
    expect(res.status).toBe(400);
    expect(prisma.factory.findFirst).not.toHaveBeenCalled();
  });

  it('scopes process access through the owning factory’s organization', async () => {
    asUser('CONSULTANT', 4);
    prisma.process.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/processes/9').set('Authorization', bearer(5));
    expect(res.status).toBe(404);
    expect(prisma.process.findFirst).toHaveBeenCalledWith({ where: { id: 9, factory: { organization_id: 4 } } });
  });
});

describe('role authorization', () => {
  it('allows permitted roles', async () => {
    asUser('ADMIN');
    const res = await request(app).post('/config').set('Authorization', bearer(5));
    expect(res.status).toBe(200);
  });

  it('uses the database role, not the role claimed in the token', async () => {
    asUser('CONSULTANT'); // token claims ADMIN
    const res = await request(app).post('/config').set('Authorization', bearer(5));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
