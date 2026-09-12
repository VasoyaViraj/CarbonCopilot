import { z } from 'zod';
import { ACTIVITY_SOURCES, HISTORY_GRANULARITIES, MAX_DAILY_HISTORY_DAYS } from '../constants.js';
import { activityTypeFilter, dateFilter, paginationShape, withOrderedDateRange } from './activity.validators.js';
import { checkActivityQuantity, resolveTypeOrError, resolveUnitOrError } from './activity.rules.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const fail = (ctx, path, message) => {
  ctx.addIssue({ code: 'custom', path: [path], message });
  return z.NEVER;
};

const sourceFilter = z.enum(Object.values(ACTIVITY_SOURCES));

export const emissionSummaryQuerySchema = withOrderedDateRange(
  z
    .object({
      from: dateFilter.optional(),
      to: dateFilter.optional(),
      source: sourceFilter.optional(),
      granularity: z.enum(HISTORY_GRANULARITIES).default('month'),
    })
    .strict()
).refine(
  (query) =>
    query.granularity !== 'day' || (query.from && query.to && (query.to - query.from) / DAY_MS + 1 <= MAX_DAILY_HISTORY_DAYS),
  { path: ['granularity'], message: `Daily history needs "from" and "to" no more than ${MAX_DAILY_HISTORY_DAYS} days apart` }
);

export const listEmissionsQuerySchema = withOrderedDateRange(
  z
    .object({
      from: dateFilter.optional(),
      to: dateFilter.optional(),
      source: sourceFilter.optional(),
      energyType: activityTypeFilter.optional(),
      processId: z.coerce.number().int().positive().optional(),
      ...paginationShape,
    })
    .strict()
);

const AD_HOC_FIELDS = ['activityType', 'quantity', 'unit', 'emissionFactorId'];

/**
 * Either { activityId } — recalculate and store a persisted activity's emission — or an ad-hoc
 * { activityType, quantity, unit?, emissionFactorId? } calculation that stores nothing.
 */
export const calculateEmissionSchema = z
  .object({
    activityId: z.number().int().positive().optional(),
    activityType: z.string().trim().min(1, 'Activity type is required').max(50).optional(),
    quantity: z.number({ error: 'Quantity must be a number' }).optional(),
    unit: z.string().trim().max(20).optional().nullable(),
    emissionFactorId: z.number().int().positive().optional(),
  })
  .strict()
  .transform((body, ctx) => {
    if (body.activityId != null) {
      if (AD_HOC_FIELDS.some((field) => body[field] != null)) {
        return fail(ctx, 'activityId', 'Send either activityId or activityType and quantity, not both');
      }
      return { activityId: body.activityId };
    }

    if (body.activityType == null) return fail(ctx, 'activityType', 'Activity type is required (or send activityId)');
    const type = resolveTypeOrError(body.activityType);
    if (type.error) return fail(ctx, 'activityType', type.error);

    if (body.quantity == null) return fail(ctx, 'quantity', 'Quantity is required');
    // Zero is a valid what-if input here; anything else follows the ingestion rules.
    const quantityError = body.quantity === 0 ? null : checkActivityQuantity(type.key, body.quantity);
    if (quantityError) return fail(ctx, 'quantity', quantityError);

    const unit = resolveUnitOrError(type.key, body.unit);
    if (unit.error) return fail(ctx, 'unit', unit.error);

    return { activityType: type.key, quantity: body.quantity, unit: unit.unit, emissionFactorId: body.emissionFactorId };
  });
