import { getAuthorizedFactory } from '../services/access.service.js';
import { generateFactoryReport } from '../services/report.service.js';
import { sendSuccess } from '../utils/response.js';

export const getFactoryReport = async (req, res) => {
  const factoryId = parseInt(req.params.factoryId, 10);
  const factory = await getAuthorizedFactory(req.user, factoryId);
  const report = await generateFactoryReport(factory);
  sendSuccess(res, report);
};
