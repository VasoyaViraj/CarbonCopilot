import express from 'express';
import {
  createFactory,
  getFactories,
  getFactory,
  updateFactory,
  deleteFactory,
  createProcess,
  getProcesses,
  updateProcess,
  deleteProcess
} from '../controllers/factory.controller.js';
import { authenticate, requireFactoryAccess, authorize } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createFactorySchema,
  updateFactorySchema,
  processSchema,
  updateProcessSchema
} from '../validators/factory.validators.js';
import { ROLE_GROUPS } from '../constants.js';

const router = express.Router();

router.use(authenticate);

// Every role in the organization may read; only admins and factory operators may change
// factory configuration (consultants analyse, regulators are read-only).
const canManage = authorize(ROLE_GROUPS.MANAGE_FACTORIES);

// Factory CRUD
router.post('/', canManage, validate({ body: createFactorySchema }), createFactory);
router.get('/', getFactories);
router.get('/:id', requireFactoryAccess('id'), getFactory);
router.put('/:id', canManage, requireFactoryAccess('id'), validate({ body: updateFactorySchema }), updateFactory);
router.delete('/:id', canManage, requireFactoryAccess('id'), deleteFactory);

// Process CRUD within Factory
router.post('/:id/processes', canManage, requireFactoryAccess('id'), validate({ body: processSchema }), createProcess);
router.get('/:id/processes', requireFactoryAccess('id'), getProcesses);

// Individual process endpoints
router.put(
  '/:id/processes/:processId',
  canManage,
  requireFactoryAccess('id'),
  validate({ body: updateProcessSchema }),
  updateProcess
);
router.delete('/:id/processes/:processId', canManage, requireFactoryAccess('id'), deleteProcess);

export default router;
