import express from 'express';
import { calculateScenario, listScenarios, saveScenario } from '../controllers/scenario.controller.js';
import { authenticate, requireFactoryAccess } from '../middleware/auth.middleware.js';
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

router.post(
  '/factories/:id/scenarios',
  authenticate,
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
