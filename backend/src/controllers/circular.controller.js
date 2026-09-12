import { listAlternatives } from '../services/circular.service.js';
import { sendSuccess } from '../utils/response.js';

export const getAlternatives = async (req, res) => {
  sendSuccess(res, { alternatives: await listAlternatives(req.validated.query) });
};
