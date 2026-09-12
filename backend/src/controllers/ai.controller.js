import * as aiService from '../services/ai.service.js';
import { getAuthorizedFactory } from '../services/access.service.js';
import { sendSuccess } from '../utils/response.js';

export const askCopilot = async (req, res) => {
  const { factoryId, message, conversationId } = req.validated.body;
  // Authorize the factory before anything reaches the AI service (BR-13).
  const factory = await getAuthorizedFactory(req.user, factoryId);
  const answer = await aiService.askCopilot({ user: req.user, factory, message, conversationId });
  sendSuccess(res, answer);
};
