import { z } from 'zod';

export const anomalyQuerySchema = z
  .object({
    threshold: z.coerce.number().min(0).max(100).default(20),
    baselineDays: z.coerce.number().int().min(1).max(30).default(7),
  })
  .strict();
