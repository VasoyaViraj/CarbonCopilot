import * as activityService from '../services/activity.service.js';
import { buildCsvTemplate, describeCsvFormat, importActivitiesCsv } from '../services/csvIngestion.service.js';
import { getAuthorizedFactory, getAuthorizedProcess } from '../services/access.service.js';
import { describeCatalog } from '../config/activityCatalog.js';
import { ACTIVITY_SOURCES } from '../constants.js';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/response.js';

export const getActivityCatalog = async (req, res) => {
  sendSuccess(res, {
    ...describeCatalog(),
    sources: Object.values(ACTIVITY_SOURCES),
    csv: { ...describeCsvFormat(), maxFileSizeMb: env.MAX_UPLOAD_SIZE_MB },
  });
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

export const uploadActivitiesCsv = async (req, res) => {
  // factoryId comes from the form body, so it is authorized here rather than by route middleware.
  const factory = await getAuthorizedFactory(req.user, req.body.factoryId);
  const summary = await importActivitiesCsv({
    factory,
    file: req.file,
    dryRun: req.body.dryRun,
    skipInvalidRows: req.body.skipInvalidRows,
  });
  sendSuccess(res, summary, summary.imported ? 201 : 200);
};

export const downloadCsvTemplate = async (req, res) => {
  res.attachment('ecotrace-activities-template.csv').type('text/csv').send(buildCsvTemplate());
};
