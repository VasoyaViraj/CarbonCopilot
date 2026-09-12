import express from 'express';
import { getHotspot, listHotspots } from '../controllers/hotspot.controller.js';
import { authenticate, requireFactoryAccess } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { hotspotQuerySchema } from '../validators/hotspot.validators.js';

// Deterministic hotspot analysis. Read-only, so every role in the organization may use it.
const router = express.Router();

router.get('/factories/:id/hotspots', authenticate, requireFactoryAccess('id'), validate({ query: hotspotQuerySchema }), listHotspots);
router.get(
  '/factories/:id/hotspots/:processId',
  authenticate,
  requireFactoryAccess('id'),
  validate({ query: hotspotQuerySchema }),
  getHotspot
);

export default router;
