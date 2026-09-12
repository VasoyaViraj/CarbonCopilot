import express from 'express';
import { generateRecommendations, listRecommendations } from '../controllers/recommendation.controller.js';
import { authenticate, authorize, requireFactoryAccess } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { generateRecommendationsSchema, listRecommendationsQuerySchema } from '../validators/recommendation.validators.js';
import { ROLE_GROUPS } from '../constants.js';

// Every role in the organization may read recommendations; admins, operators and consultants may
// (re)generate them. Regulators are read-only.
const router = express.Router();

router.get(
  '/factories/:id/recommendations',
  authenticate,
  requireFactoryAccess('id'),
  validate({ query: listRecommendationsQuerySchema }),
  listRecommendations
);
router.post(
  '/factories/:id/recommendations/generate',
  authenticate,
  authorize(ROLE_GROUPS.RUN_ANALYSIS),
  requireFactoryAccess('id'),
  validate({ body: generateRecommendationsSchema }),
  generateRecommendations
);

export default router;
