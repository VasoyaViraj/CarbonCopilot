import * as activityService from '../services/activity.service.js';
import { getAuthorizedProcess } from '../services/access.service.js';
import { describeCatalog } from '../config/activityCatalog.js';
import { ACTIVITY_SOURCES } from '../constants.js';
import { sendSuccess } from '../utils/response.js';

export const getActivityCatalog = async (req, res) => {
  sendSuccess(res, { ...describeCatalog(), sources: Object.values(ACTIVITY_SOURCES) });
};

export const createActivity = async (req, res) => {
  const process = await getAuthorizedProcess(req.user, req.params.id);
  const activity = await activityService.createActivity(process.id, req.body);
  sendSuccess(res, activity, 201);
};

export const listProcessActivities = async (req, res) => {
  const process = await getAuthorizedProcess(req.user, req.params.id);
  const result = await activityService.listActivities({ processId: process.id }, req.validated.query);
  sendSuccess(res, result);
};

export const listFactoryActivities = async (req, res) => {
  // req.factory is loaded (and organization-scoped) by requireFactoryAccess
  const result = await activityService.listActivities({ factoryId: req.factory.id }, req.validated.query);
  sendSuccess(res, result);
};
