import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import factoryRoutes from './factory.routes.js';
import activityRoutes from './activity.routes.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
// Mounted before /factories so /factories/:id/activities is matched without re-running the factory router's auth.
router.use(activityRoutes);
router.use('/factories', factoryRoutes);

export default router;
