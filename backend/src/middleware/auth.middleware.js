import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getUserById } from '../services/auth.service.js';
import { getAuthorizedFactory } from '../services/access.service.js';

const SERVICE_TOKEN_HEADER = 'x-ai-service-token';
const ACTING_USER_HEADER = 'x-acting-user-id';
// Stateless calculations the AI service may POST. Everything else it may only read.
const SERVICE_WRITE_ALLOWLIST = [/^\/api\/factories\/\d+\/scenarios\/calculate\/?$/, /^\/api\/emissions\/calculate\/?$/];

function extractToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return req.cookies?.token ?? null;
}

const toRequestUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  organizationId: user.organization_id,
});

async function loadUser(rawId) {
  const userId = Number(rawId);
  return Number.isSafeInteger(userId) && userId > 0 ? getUserById(userId) : null;
}

function isServiceToken(value) {
  if (!env.AI_SERVICE_TOKEN || typeof value !== 'string') return false;
  const expected = Buffer.from(env.AI_SERVICE_TOKEN);
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function assertServiceMayCall(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const path = req.originalUrl.split('?')[0];
  // The stored-activity form of /emissions/calculate rewrites an emission record.
  const storedRecalculation = req.body && typeof req.body === 'object' && 'activityId' in req.body;
  if (!SERVICE_WRITE_ALLOWLIST.some((pattern) => pattern.test(path)) || storedRecalculation) {
    throw ApiError.forbidden('The AI service may only read data and run stateless calculations');
  }
}

/**
 * The AI service calls back into this API while answering a copilot question that
 * Express forwarded for an authenticated user. The shared secret proves the caller is
 * the AI service; X-Acting-User-Id names that user, who is loaded from the database so
 * every organization/factory check applies exactly as for their own JWT (BR-13).
 */
async function authenticateAiService(req) {
  if (!isServiceToken(req.get(SERVICE_TOKEN_HEADER))) throw ApiError.unauthenticated('Invalid service credentials');
  const user = await loadUser(req.get(ACTING_USER_HEADER));
  if (!user) throw ApiError.unauthenticated('Unknown acting user');
  assertServiceMayCall(req);
  req.user = toRequestUser(user);
  req.viaAiService = true;
}

/**
 * Verifies the JWT and loads the user from the database on every request, so deleted
 * users and role changes take effect immediately. Role/organization claims inside the
 * token are never trusted for authorization.
 */
export const authenticate = async (req, res, next) => {
  if (req.get(SERVICE_TOKEN_HEADER) !== undefined) {
    await authenticateAiService(req);
    return next();
  }

  const token = extractToken(req);
  if (!token) throw ApiError.unauthenticated();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthenticated('Invalid or expired token');
  }

  const user = await loadUser(payload.sub);
  if (!user) throw ApiError.unauthenticated('Invalid or expired token');

  req.user = toRequestUser(user);
  next();
};

/** Allows only the given roles (accepts role names or ROLE_GROUPS arrays). */
export const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) throw ApiError.unauthenticated();
    if (!allowedRoles.flat().includes(req.user.role)) throw ApiError.forbidden();
    next();
  };

/** Resolves req.params[param] to a factory in the caller's organization and exposes it as req.factory. */
export const requireFactoryAccess =
  (param = 'id') =>
  async (req, res, next) => {
    req.factory = await getAuthorizedFactory(req.user, req.params[param]);
    next();
  };
