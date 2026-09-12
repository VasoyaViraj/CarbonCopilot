import express from 'express';
import {
  createActivity,
  getActivityCatalog,
  listFactoryActivities,
  listProcessActivities,
} from '../controllers/activity.controller.js';
import { authenticate, authorize, requireFactoryAccess } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createActivitySchema, listActivitiesQuerySchema } from '../validators/activity.validators.js';
import { ROLE_GROUPS } from '../constants.js';

// Operational data ingestion. Mounted at the API root because activity endpoints span
// /activities, /processes/:id and /factories/:id.
const router = express.Router();

router.get('/activities/types', authenticate, getActivityCatalog);

router.post(
  '/processes/:id/activities',
  authenticate,
  authorize(ROLE_GROUPS.WRITE_OPERATIONAL_DATA),
  validate({ body: createActivitySchema }),
  createActivity
);
router.get('/processes/:id/activities', authenticate, validate({ query: listActivitiesQuerySchema }), listProcessActivities);

router.get(
  '/factories/:id/activities',
  authenticate,
  requireFactoryAccess('id'),
  validate({ query: listActivitiesQuerySchema }),
  listFactoryActivities
);

export default router;
