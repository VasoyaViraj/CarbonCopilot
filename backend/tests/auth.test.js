import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({ current: null }));
vi.mock('../src/db/db.js', async () => {
  const { createPrismaMock } = await import('./helpers/prismaMock.js');
  prismaMock.current = createPrismaMock();
  return { default: prismaMock.current };
});

const { default: app } = await import('../src/app.js');
const prisma = prismaMock.current;

const SECRET = process.env.JWT_SECRET;
const PASSWORD = 'Correct-Horse-9';
const passwordHash = await bcrypt.hash(PASSWORD, 4);
const dbUser = {
  id: 7,
  name: 'Operator',
  email: 'operator@example.com',
  password_hash: passwordHash,
  role: 'FACTORY_OPERATOR',
  organization_id: 3,
};
const publicDbUser = { id: 7, name: 'Operator', email: 'operator@example.com', role: 'FACTORY_OPERATOR', organization_id: 3 };
const token = (claims = {}, options = {}) =>
  jwt.sign({ role: 'FACTORY_OPERATOR', ...claims }, SECRET, { subject: '7', algorithm: 'HS256', expiresIn: '1h', ...options });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
});

describe('POST /api/auth/register', () => {
  const valid = { name: 'Operator', email: 'Operator@Example.com', password: PASSWORD, role: 'FACTORY_OPERATOR' };

  it('creates a new organization and user with a hashed password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.organization.create.mockResolvedValue({ id: 42 });
    prisma.user.create.mockImplementation(async ({ data }) => ({ id: 11, ...data }));

    const res = await request(app).post('/api/auth/register').send({ ...valid, organizationName: 'Acme Metals' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toEqual({
      id: 11,
      name: 'Operator',
      email: 'operator@example.com',
      role: 'FACTORY_OPERATOR',
      organizationId: 42,
    });
    expect(prisma.organization.create).toHaveBeenCalledWith({ data: { name: 'Acme Metals' } });
    const stored = prisma.user.create.mock.calls[0][0].data;
    expect(stored.password_hash).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, stored.password_hash)).toBe(true);
    expect(jwt.verify(res.body.data.accessToken, SECRET).sub).toBe('11');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('rejects self-assigned ADMIN role', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('role');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a client-supplied organization_id instead of trusting it', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, organization_id: 1 });
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('validates email and password', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('returns 409 for a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 });
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token and public user on valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const res = await request(app).post('/api/auth/login').send({ email: 'operator@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: 7, name: 'Operator', email: 'operator@example.com', role: 'FACTORY_OPERATOR', organizationId: 3 });
    expect(jwt.verify(res.body.data.accessToken, SECRET, { algorithms: ['HS256'] }).sub).toBe('7');
  });

  it('returns the same INVALID_CREDENTIALS error for wrong password and unknown email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(dbUser).mockResolvedValueOnce(null);
    const wrong = await request(app).post('/api/auth/login').send({ email: 'operator@example.com', password: 'wrong-password' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: PASSWORD });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    prisma.user.findUnique.mockResolvedValue(publicDbUser);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: 7, role: 'FACTORY_OPERATOR', organizationId: 3 });
  });

  it('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  const rejected = {
    'a tampered payload': () => {
      const [h, , s] = token().split('.');
      const forged = Buffer.from(JSON.stringify({ sub: '1', role: 'ADMIN' })).toString('base64url');
      return `${h}.${forged}.${s}`;
    },
    'a token signed with another secret': () => jwt.sign({ role: 'ADMIN' }, 'attacker-secret-value', { subject: '7' }),
    'an unsigned alg=none token': () => jwt.sign({ role: 'ADMIN' }, null, { subject: '7', algorithm: 'none' }),
    'an expired token': () => token({}, { expiresIn: -10 }),
  };
  for (const [name, makeToken] of Object.entries(rejected)) {
    it(`rejects ${name}`, async () => {
      prisma.user.findUnique.mockResolvedValue(publicDbUser);
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  }

  it('rejects a valid token for a user that no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^token=;/);
  });
});
