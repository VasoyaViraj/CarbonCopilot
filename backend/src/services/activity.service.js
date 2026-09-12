import prisma from '../db/db.js';
import { ACTIVITY_SOURCES } from '../constants.js';
import { ACTIVITY_TYPES } from '../config/activityCatalog.js';
import { buildEmissionData, findEmissionFactor, toEmissionDto } from './carbon.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const processSelect = { select: { id: true, name: true } };
// Each activity carries its latest calculated emission, so clients display backend-calculated CO2e.
const activityInclude = {
  process: processSelect,
  emissions: { orderBy: [{ calculated_at: 'desc' }, { id: 'desc' }], take: 1 },
};

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
    emission: toEmissionDto(activity.emissions?.[0]),
  };
}

/**
 * Stores a normalised activity (output of createActivitySchema) and its deterministic emission
 * in one transaction. The factor is resolved first, so an activity is never stored without it.
 */
export async function createActivity(processId, input) {
  return prisma.$transaction(async (tx) => {
    const factor = await findEmissionFactor({ activityType: input.energyType, unit: input.unit }, tx);
    const activity = await tx.activity.create({
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
      include: { process: processSelect },
    });
    const emission = await tx.emission.create({ data: buildEmissionData(activity, factor) });
    return toActivityDto({ ...activity, emissions: [emission] });
  });
}

/**
 * Prisma filter for the activities of a process and/or every process of a factory, narrowed by
 * the shared list filters (from/to inclusive days, source, energyType). Callers must have
 * already authorized the process/factory against the user's organization.
 */
export function activityWhere({ processId, factoryId }, query = {}) {
  const where = {};
  if (processId) where.process_id = processId;
  if (factoryId) where.process = { factory_id: factoryId };
  if (query.source) where.source = query.source;
  if (query.energyType) where.energy_type = query.energyType;
  if (query.from || query.to) {
    where.activity_date = {};
    if (query.from) where.activity_date.gte = query.from;
    // "to" is an inclusive calendar day.
    if (query.to) where.activity_date.lt = new Date(query.to.getTime() + DAY_MS);
  }
  return where;
}

/** Lists activities for one process or for every process of a factory (see activityWhere). */
export async function listActivities({ processId, factoryId }, query) {
  const where = activityWhere(processId ? { processId } : { factoryId }, query);
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
