import express from 'express';
import { getAlternatives } from '../controllers/circular.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/alternatives', authenticate, getAlternatives);

export default router;
