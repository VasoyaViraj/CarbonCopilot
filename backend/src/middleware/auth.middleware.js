import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getUserById } from '../services/auth.service.js';
import { getAuthorizedFactory } from '../services/access.service.js';

function extractToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return req.cookies?.token ?? null;
}

/**
 * Verifies the JWT and loads the user from the database on every request, so deleted
 * users and role changes take effect immediately. Role/organization claims inside the
 * token are never trusted for authorization.
 */
export const authenticate = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthenticated();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthenticated('Invalid or expired token');
  }

  const userId = Number(payload.sub);
  const user = Number.isSafeInteger(userId) && userId > 0 ? await getUserById(userId) : null;
  if (!user) throw ApiError.unauthenticated('Invalid or expired token');

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
  };
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
