import prisma from '../db/db.js';
import { ApiError } from '../utils/ApiError.js';

/** Parses a route/body identifier; malformed IDs are a validation error. */
export function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid input', [{ field: label, message: 'Must be a positive integer' }]);
  }
  return id;
}

/**
 * Loads a factory only if it belongs to the caller's organization.
 * Client-supplied factory IDs are never trusted: the query itself is scoped to the
 * authenticated organization, and cross-organization factories are reported as
 * NOT_FOUND so their existence is not disclosed.
 */
export async function getAuthorizedFactory(user, factoryId) {
  const id = parseId(factoryId, 'factoryId');
  const factory = await prisma.factory.findFirst({ where: { id, organization_id: user.organizationId } });
  if (!factory) throw ApiError.notFound('Factory');
  return factory;
}

/** Loads a process only if its factory belongs to the caller's organization. */
export async function getAuthorizedProcess(user, processId) {
  const id = parseId(processId, 'processId');
  const process = await prisma.process.findFirst({
    where: { id, factory: { organization_id: user.organizationId } },
  });
  if (!process) throw ApiError.notFound('Process');
  return process;
}
