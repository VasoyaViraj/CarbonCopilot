import express from 'express';
import { getFactoryReport } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/factories/:factoryId/report', authenticate, getFactoryReport);

export default router;
