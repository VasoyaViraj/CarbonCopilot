import { z } from 'zod';

export const calculateScenarioSchema = z
  .object({
    recycledMaterialPercent: z.number().min(0).max(100).default(0),
    energyEfficiencyPercent: z.number().min(0).max(100).default(0),
    fuelReplacementPercent: z.number().min(0).max(100).default(0),
    wasteRecoveryPercent: z.number().min(0).max(100).default(0),
  })
  .strict();

export const saveScenarioSchema = calculateScenarioSchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
});
