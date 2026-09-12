import * as recommendationService from '../services/recommendation.service.js';
import { sendSuccess } from '../utils/response.js';

// req.factory is loaded (and organization-scoped) by requireFactoryAccess.
export const listRecommendations = async (req, res) => {
  sendSuccess(res, await recommendationService.listRecommendations(req.factory, req.validated.query));
};

export const generateRecommendations = async (req, res) => {
  sendSuccess(res, await recommendationService.generateRecommendations(req.factory), 201);
};
