import express from 'express';
import { askCopilot, getConversationHistory } from '../controllers/ai.controller.js';
import { authenticate, requireFactoryAccess } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { copilotRequestSchema } from '../validators/ai.validators.js';

// Every role in the organization may ask the copilot about its factories.
const router = express.Router();

router.post('/ai/copilot', authenticate, validate({ body: copilotRequestSchema }), askCopilot);
router.get('/factories/:id/ai/history', authenticate, requireFactoryAccess('id'), getConversationHistory);

export default router;
