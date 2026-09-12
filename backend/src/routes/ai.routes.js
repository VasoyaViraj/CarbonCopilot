import express from 'express';
import { askCopilot } from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { copilotRequestSchema } from '../validators/ai.validators.js';

// Every role in the organization may ask the copilot about its factories.
const router = express.Router();

router.post('/ai/copilot', authenticate, validate({ body: copilotRequestSchema }), askCopilot);

export default router;
