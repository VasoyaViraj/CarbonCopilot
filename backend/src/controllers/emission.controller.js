import * as emissionAnalytics from '../services/emissionAnalytics.service.js';
import { calculateEmissions, recalculateActivityEmission } from '../services/carbon.service.js';
import { getAuthorizedActivity } from '../services/access.service.js';
import { ROLE_GROUPS } from '../constants.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

export const calculateEmission = async (req, res) => {
  if (req.body.activityId == null) {
    // Ad-hoc calculation: nothing is stored, so every role in the organization may use it.
    sendSuccess(res, await calculateEmissions(req.body));
    return;
  }
  // Recalculating a stored activity replaces its emission, which is an operational-data write.
  if (!ROLE_GROUPS.WRITE_OPERATIONAL_DATA.includes(req.user.role)) throw ApiError.forbidden();
  const activity = await getAuthorizedActivity(req.user, req.body.activityId);
  sendSuccess(res, await recalculateActivityEmission(activity.id));
};

export const getEmissionSummary = async (req, res) => {
  // req.factory is loaded (and organization-scoped) by requireFactoryAccess
  sendSuccess(res, await emissionAnalytics.getEmissionSummary(req.factory, req.validated.query));
};

export const listFactoryEmissions = async (req, res) => {
  sendSuccess(res, await emissionAnalytics.listEmissions(req.factory, req.validated.query));
};
