import express from 'express';
import { calculateScenario, listScenarios, saveScenario } from '../controllers/scenario.controller.js';
import { authenticate, authorize, requireFactoryAccess } from '../middleware/auth.middleware.js';
import { ROLE_GROUPS } from '../constants.js';
import { validate } from '../middleware/validate.middleware.js';
import { calculateScenarioSchema, saveScenarioSchema } from '../validators/scenario.validators.js';

const router = express.Router();

router.post(
  '/factories/:id/scenarios/calculate',
  authenticate,
  requireFactoryAccess('id'),
  validate({ body: calculateScenarioSchema }),
  calculateScenario
);

// Calculating and listing are read-only; saving stores a scenario, which regulators (read-only) may not.
router.post(
  '/factories/:id/scenarios',
  authenticate,
  authorize(ROLE_GROUPS.RUN_ANALYSIS),
  requireFactoryAccess('id'),
  validate({ body: saveScenarioSchema }),
  saveScenario
);

router.get(
  '/factories/:id/scenarios',
  authenticate,
  requireFactoryAccess('id'),
  listScenarios
);

export default router;
