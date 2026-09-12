import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import factoryRoutes from './factory.routes.js';
import activityRoutes from './activity.routes.js';
import emissionRoutes from './emission.routes.js';
import anomalyRoutes from './anomaly.routes.js';
import hotspotRoutes from './hotspot.routes.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
// Mounted before /factories so /factories/:id/activities, /emissions and /hotspots are matched
// without re-running the factory router's auth.
router.use(activityRoutes);
router.use(emissionRoutes);
router.use(anomalyRoutes);
router.use(hotspotRoutes);
router.use('/factories', factoryRoutes);

export default router;
