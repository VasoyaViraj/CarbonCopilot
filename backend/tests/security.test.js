import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';

const prismaMock = vi.hoisted(() => ({ current: null }));
vi.mock('../src/db/db.js', async () => {
  const { createPrismaMock } = await import('./helpers/prismaMock.js');
  prismaMock.current = createPrismaMock();
  return { default: prismaMock.current };
});

const { default: app } = await import('../src/app.js');
const prisma = prismaMock.current;

const PASSWORD = 'Correct-Horse-9';
const dbUser = {
  id: 7,
  name: 'Operator',
  email: 'operator@example.com',
  password_hash: await bcrypt.hash(PASSWORD, 4),
  role: 'FACTORY_OPERATOR',
  organization_id: 3,
};
const login = (password) => request(app).post('/api/auth/login').send({ email: dbUser.email, password });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(dbUser);
});

describe('security headers', () => {
  it('sets hardening headers and does not advertise the framework', async () => {
    const res = await request(app).get('/api/unknown-route');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('login rate limiting', () => {
  it('blocks repeated failed sign-ins without counting successful ones', async () => {
    for (let i = 0; i < 12; i += 1) expect((await login(PASSWORD)).status).toBe(200);
    for (let i = 0; i < 10; i += 1) expect((await login('wrong-password')).status).toBe(401);

    const blocked = await login('wrong-password');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many failed sign-in attempts. Try again in 15 minutes.' },
    });
    // While blocked, even correct credentials are refused, so guessing cannot continue.
    expect((await login(PASSWORD)).status).toBe(429);
  });
});
