import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import factoryRoutes from './factory.routes.js';
import activityRoutes from './activity.routes.js';
import emissionRoutes from './emission.routes.js';
import anomalyRoutes from './anomaly.routes.js';
import hotspotRoutes from './hotspot.routes.js';
import recommendationRoutes from './recommendation.routes.js';
import scenarioRoutes from './scenario.routes.js';
import reportRoutes from './report.routes.js';
import aiRoutes from './ai.routes.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
// Mounted before /factories so nested factory feature routes are matched
// without re-running the factory router's auth.
router.use(activityRoutes);
router.use(emissionRoutes);
router.use(anomalyRoutes);
router.use(hotspotRoutes);
router.use(recommendationRoutes);
router.use(scenarioRoutes);
router.use(reportRoutes);
router.use(aiRoutes);
router.use('/factories', factoryRoutes);

export default router;
