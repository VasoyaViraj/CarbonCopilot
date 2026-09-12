import { z } from 'zod';
import { RECOMMENDATION_STATUSES } from '../constants.js';

export const listRecommendationsQuerySchema = z
  .object({ status: z.enum(Object.values(RECOMMENDATION_STATUSES)).optional() })
  .strict();

/** Generation takes no input: the factory's own data and the knowledge base decide the result. */
export const generateRecommendationsSchema = z.object({}).strict();
