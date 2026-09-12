import * as anomalyService from '../services/anomaly.service.js';
import { sendSuccess } from '../utils/response.js';

export const getAnomalySignal = async (req, res) => {
  // req.factory is loaded (and organization-scoped) by requireFactoryAccess
  const signal = await anomalyService.detectAnomaly(req.factory, req.validated.query);
  sendSuccess(res, signal);
};
