import express from 'express';
import { getAlternatives } from '../controllers/circular.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/alternatives', protect, getAlternatives);

export default router;
