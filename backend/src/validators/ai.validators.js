import { z } from 'zod';

export const copilotRequestSchema = z
  .object({
    factoryId: z.number().int().positive(),
    conversationId: z.number().int().positive().optional().nullable(),
    message: z.string().trim().min(1).max(2000),
  })
  .strict();
