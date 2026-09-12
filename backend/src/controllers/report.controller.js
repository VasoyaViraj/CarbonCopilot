import { generateFactoryReport } from '../services/report.service.js';
import { sendSuccess } from '../utils/response.js';

// req.factory is loaded (and organization-scoped) by requireFactoryAccess.
export const getFactoryReport = async (req, res) => {
  sendSuccess(res, await generateFactoryReport(req.factory));
};
