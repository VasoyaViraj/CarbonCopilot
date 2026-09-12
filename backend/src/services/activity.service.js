import prisma from '../db/db.js';
import { ACTIVITY_SOURCES } from '../constants.js';
import { ACTIVITY_TYPES } from '../config/activityCatalog.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const activityInclude = { process: { select: { id: true, name: true } } };

/** API view of an activity. Simulated readings are always flagged (BR-12). */
export function toActivityDto(activity) {
  return {
    id: activity.id,
    processId: activity.process_id,
    processName: activity.process?.name ?? null,
    activityDate: activity.activity_date.toISOString(),
    energyType: activity.energy_type,
    category: ACTIVITY_TYPES[activity.energy_type]?.category ?? null,
    quantity: activity.quantity,
    unit: activity.unit,
    productionQuantity: activity.production_quantity,
    productionUnit: activity.production_unit,
    source: activity.source,
    isSimulated: activity.source === ACTIVITY_SOURCES.SIMULATION,
    createdAt: activity.created_at.toISOString(),
  };
}

/** `input` is the normalised output of createActivitySchema. */
export async function createActivity(processId, input) {
  const activity = await prisma.activity.create({
    data: {
      process_id: processId,
      activity_date: input.activityDate,
      energy_type: input.energyType,
      quantity: input.quantity,
      unit: input.unit,
      production_quantity: input.productionQuantity,
      production_unit: input.productionUnit,
      source: input.source,
    },
    include: activityInclude,
  });
  return toActivityDto(activity);
}

/**
 * Lists activities for one process or for every process of a factory. Callers must have
 * already authorized the process/factory against the user's organization.
 */
export async function listActivities({ processId, factoryId }, query) {
  const where = processId ? { process_id: processId } : { process: { factory_id: factoryId } };
  if (query.source) where.source = query.source;
  if (query.energyType) where.energy_type = query.energyType;
  if (query.from || query.to) {
    where.activity_date = {};
    if (query.from) where.activity_date.gte = query.from;
    // "to" is an inclusive calendar day.
    if (query.to) where.activity_date.lt = new Date(query.to.getTime() + DAY_MS);
  }

  const [items, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: activityInclude,
      orderBy: [{ activity_date: 'desc' }, { id: 'desc' }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.activity.count({ where }),
  ]);

  return { items: items.map(toActivityDto), total, limit: query.limit, offset: query.offset };
}
