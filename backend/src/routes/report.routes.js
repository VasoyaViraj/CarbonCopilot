import express from 'express';
import { getFactoryReport } from '../controllers/report.controller.js';
import { authenticate, requireFactoryAccess } from '../middleware/auth.middleware.js';

// Read-only carbon assessment report, so every role in the organization may use it.
const router = express.Router();

router.get('/factories/:id/report', authenticate, requireFactoryAccess('id'), getFactoryReport);

export default router;
