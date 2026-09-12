import * as factoryService from '../services/factory.service.js';
import { getAuthorizedProcess } from '../services/access.service.js';
import { sendSuccess } from '../utils/response.js';

export const createFactory = async (req, res) => {
  const factory = await factoryService.createFactory(req.user, req.body);
  sendSuccess(res, factory, 201);
};

export const getFactories = async (req, res) => {
  const factories = await factoryService.getFactories(req.user);
  sendSuccess(res, factories);
};

export const getFactory = async (req, res) => {
  // req.factory is loaded by requireFactoryAccess middleware
  sendSuccess(res, req.factory);
};

export const updateFactory = async (req, res) => {
  const factory = await factoryService.updateFactory(req.factory.id, req.body);
  sendSuccess(res, factory);
};

export const deleteFactory = async (req, res) => {
  await factoryService.deleteFactory(req.factory.id);
  sendSuccess(res, { deleted: true });
};

// Process Controllers

export const createProcess = async (req, res) => {
  const process = await factoryService.createProcess(req.factory.id, req.body);
  sendSuccess(res, process, 201);
};

export const getProcesses = async (req, res) => {
  const processes = await factoryService.getProcesses(req.factory.id);
  sendSuccess(res, processes);
};

export const updateProcess = async (req, res) => {
  const process = await getAuthorizedProcess(req.user, req.params.processId);
  const updatedProcess = await factoryService.updateProcess(process.id, req.body);
  sendSuccess(res, updatedProcess);
};

export const deleteProcess = async (req, res) => {
  const process = await getAuthorizedProcess(req.user, req.params.processId);
  await factoryService.deleteProcess(process.id);
  sendSuccess(res, { deleted: true });
};
