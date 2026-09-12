import { z } from 'zod';

const option = z.string().trim().min(1).max(100);

/** Filters for the circular alternatives knowledge base. */
export const alternativesQuerySchema = z
  .object({
    category: option.optional(),
    material: option.optional(),
    waste: option.optional(),
    energy: option.optional(),
  })
  .strict();
