import * as scenarioService from '../services/scenario.service.js';
import { sendSuccess } from '../utils/response.js';

export const calculateScenario = async (req, res) => {
  const result = await scenarioService.calculateScenario(req.factory, req.validated.body);
  sendSuccess(res, result);
};

export const saveScenario = async (req, res) => {
  const scenario = await scenarioService.saveScenario(req.factory, req.validated.body);
  sendSuccess(res, scenario, 201);
};

export const listScenarios = async (req, res) => {
  const scenarios = await scenarioService.listScenarios(req.factory);
  sendSuccess(res, scenarios);
};
