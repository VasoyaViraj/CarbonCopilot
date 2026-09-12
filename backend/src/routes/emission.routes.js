import express from 'express';
import { calculateEmission, getEmissionSummary, listFactoryEmissions } from '../controllers/emission.controller.js';
import { authenticate, requireFactoryAccess } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  calculateEmissionSchema,
  emissionSummaryQuerySchema,
  listEmissionsQuerySchema,
} from '../validators/emission.validators.js';

// Deterministic emission calculation and dashboard analytics. Every role in the organization may
// read; the controller restricts recalculating stored activities to operational-data writers.
const router = express.Router();

router.post('/emissions/calculate', authenticate, validate({ body: calculateEmissionSchema }), calculateEmission);

router.get(
  '/factories/:id/emissions/summary',
  authenticate,
  requireFactoryAccess('id'),
  validate({ query: emissionSummaryQuerySchema }),
  getEmissionSummary
);
router.get(
  '/factories/:id/emissions',
  authenticate,
  requireFactoryAccess('id'),
  validate({ query: listEmissionsQuerySchema }),
  listFactoryEmissions
);

export default router;
