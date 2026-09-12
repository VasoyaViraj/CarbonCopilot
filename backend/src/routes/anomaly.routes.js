import express from 'express';
import { getAnomalySignal } from '../controllers/anomaly.controller.js';
import { authenticate, requireFactoryAccess } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { anomalyQuerySchema } from '../validators/anomaly.validators.js';

const router = express.Router();

router.get(
  '/factories/:id/anomaly',
  authenticate,
  requireFactoryAccess('id'),
  validate({ query: anomalyQuerySchema }),
  getAnomalySignal
);

export default router;
