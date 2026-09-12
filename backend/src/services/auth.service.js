import bcrypt from 'bcrypt';
import prisma from '../db/db.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/jwt.js';

const BCRYPT_ROUNDS = 10;

// Compared against when the email is unknown, so response timing does not reveal which emails exist.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('ecotrace-timing-equalizer', BCRYPT_ROUNDS);

const PUBLIC_USER_SELECT = { id: true, name: true, email: true, role: true, organization_id: true };

export const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  organizationId: user.organization_id,
});

export async function registerUser({ name, email, password, role, organizationName }) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Public registration always creates a new organization, so a client can never attach
  // itself to an existing organization's factories.
  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: organizationName ?? `${name}'s Organization` },
    });
    return tx.user.create({
      data: { name, email, password_hash, role, organization_id: organization.id },
    });
  });

  return { accessToken: signAccessToken(user), user: toPublicUser(user) };
}

export async function authenticateUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) throw ApiError.invalidCredentials();

  return { accessToken: signAccessToken(user), user: toPublicUser(user) };
}

export async function getUserById(id) {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
}
