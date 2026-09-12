import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import factoryRoutes from './factory.routes.js';

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/factories', factoryRoutes);

export default router;
