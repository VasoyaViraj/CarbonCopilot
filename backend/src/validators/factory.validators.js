import { z } from 'zod';

export const createFactorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  industryType: z.string().trim().max(100).optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  productionCapacity: z.number().min(0, 'Capacity must be positive').optional().nullable(),
  productionUnit: z.string().trim().max(50).optional().nullable(),
}).strict();

export const updateFactorySchema = createFactorySchema.partial();

export const processSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  processType: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
}).strict();

export const updateProcessSchema = processSchema.partial();
