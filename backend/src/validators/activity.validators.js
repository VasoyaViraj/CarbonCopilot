import { z } from 'zod';
import { ACTIVITY_SOURCES } from '../constants.js';
import {
  checkActivityQuantity,
  checkProductionQuantity,
  parseActivityDate,
  parseIsoDate,
  resolveProductionUnitOrError,
  resolveTypeOrError,
  resolveUnitOrError,
} from './activity.rules.js';

const fail = (ctx, path, message) => {
  ctx.addIssue({ code: 'custom', path: [path], message });
  return z.NEVER;
};

/**
 * Manual / simulated single-activity body. CSV rows are never accepted here: they must go
 * through the upload pipeline so they get row-level validation and duplicate protection.
 */
export const createActivitySchema = z
  .object({
    activityDate: z.string().trim().min(1, 'Activity date is required'),
    energyType: z.string().trim().min(1, 'Activity type is required').max(50),
    quantity: z.number({ error: 'Quantity must be a number' }),
    unit: z.string().trim().max(20).optional().nullable(),
    productionQuantity: z.number({ error: 'Production must be a number' }).optional().nullable(),
    productionUnit: z.string().trim().max(20).optional().nullable(),
    source: z
      .enum([ACTIVITY_SOURCES.MANUAL, ACTIVITY_SOURCES.SIMULATION], {
        error: 'Source must be MANUAL or SIMULATION (CSV rows are imported through /api/activities/upload)',
      })
      .default(ACTIVITY_SOURCES.MANUAL),
  })
  .strict()
  .transform((body, ctx) => {
    const date = parseActivityDate(body.activityDate);
    if (date.error) return fail(ctx, 'activityDate', date.error);

    const type = resolveTypeOrError(body.energyType);
    if (type.error) return fail(ctx, 'energyType', type.error);

    const unit = resolveUnitOrError(type.key, body.unit);
    if (unit.error) return fail(ctx, 'unit', unit.error);

    const quantityError = checkActivityQuantity(type.key, body.quantity);
    if (quantityError) return fail(ctx, 'quantity', quantityError);

    const hasProduction = body.productionQuantity != null;
    if (!hasProduction && body.productionUnit) {
      return fail(ctx, 'productionQuantity', 'Production quantity is required when a production unit is given');
    }
    let productionUnit = null;
    if (hasProduction) {
      const productionError = checkProductionQuantity(body.productionQuantity);
      if (productionError) return fail(ctx, 'productionQuantity', productionError);
      const resolved = resolveProductionUnitOrError(body.productionUnit);
      if (resolved.error) return fail(ctx, 'productionUnit', resolved.error);
      productionUnit = resolved.unit;
    }

    return {
      activityDate: date.date,
      energyType: type.key,
      quantity: body.quantity,
      unit: unit.unit,
      productionQuantity: hasProduction ? body.productionQuantity : null,
      productionUnit,
      source: body.source,
    };
  });

// multipart/form-data fields arrive as strings.
const formBoolean = z
  .enum(['true', 'false'], { error: 'Must be true or false' })
  .transform((value) => value === 'true')
  .default(false);

export const csvUploadBodySchema = z
  .object({
    factoryId: z.string({ error: 'factoryId is required' }).trim().min(1, 'factoryId is required'),
    dryRun: formBoolean,
    skipInvalidRows: formBoolean,
  })
  .strict();

const dateFilter = z
  .string()
  .trim()
  .refine((value) => !parseIsoDate(value).error, 'Must be a date in YYYY-MM-DD format')
  .transform((value) => parseIsoDate(value).date);

export const listActivitiesQuerySchema = z
  .object({
    from: dateFilter.optional(),
    to: dateFilter.optional(),
    source: z.enum(Object.values(ACTIVITY_SOURCES)).optional(),
    energyType: z
      .string()
      .trim()
      .transform((value, ctx) => {
        const type = resolveTypeOrError(value);
        if (!type.error) return type.key;
        ctx.addIssue({ code: 'custom', message: type.error });
        return z.NEVER;
      })
      .optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ['to'],
    message: '"to" must not be before "from"',
  });
