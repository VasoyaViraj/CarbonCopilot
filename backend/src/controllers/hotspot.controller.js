import * as hotspotService from '../services/hotspot.service.js';
import { parseId } from '../services/access.service.js';
import { sendSuccess } from '../utils/response.js';

// req.factory is loaded (and organization-scoped) by requireFactoryAccess.
export const listHotspots = async (req, res) => {
  sendSuccess(res, await hotspotService.getHotspots(req.factory, req.validated.query));
};

export const getHotspot = async (req, res) => {
  const processId = parseId(req.params.processId, 'processId');
  sendSuccess(res, await hotspotService.getHotspotDetail(req.factory, processId, req.validated.query));
};
