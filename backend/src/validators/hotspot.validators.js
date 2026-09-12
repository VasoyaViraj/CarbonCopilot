import { z } from 'zod';
import { ACTIVITY_SOURCES } from '../constants.js';
import { dateFilter, withOrderedDateRange } from './activity.validators.js';

/** Filters for hotspot ranking and detail: inclusive from/to days and data source. */
export const hotspotQuerySchema = withOrderedDateRange(
  z
    .object({
      from: dateFilter.optional(),
      to: dateFilter.optional(),
      source: z.enum(Object.values(ACTIVITY_SOURCES)).optional(),
    })
    .strict()
);
