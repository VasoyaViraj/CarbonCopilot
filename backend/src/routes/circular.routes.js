import express from 'express';
import { getAlternatives } from '../controllers/circular.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { alternativesQuerySchema } from '../validators/circular.validators.js';

// The knowledge base is shared reference data, so every authenticated role may read it.
const router = express.Router();

router.get('/circular/alternatives', authenticate, validate({ query: alternativesQuerySchema }), getAlternatives);

export default router;
