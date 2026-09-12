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

const router = express.Router();

router.use(authenticate);

// Factory CRUD
router.post('/', validate({ body: createFactorySchema }), createFactory);
router.get('/', getFactories);
router.get('/:id', requireFactoryAccess('id'), getFactory);
router.put('/:id', requireFactoryAccess('id'), validate({ body: updateFactorySchema }), updateFactory);
router.delete('/:id', requireFactoryAccess('id'), deleteFactory);

// Process CRUD within Factory
router.post('/:id/processes', requireFactoryAccess('id'), validate({ body: processSchema }), createProcess);
router.get('/:id/processes', requireFactoryAccess('id'), getProcesses);

// Individual process endpoints
router.put('/:id/processes/:processId', requireFactoryAccess('id'), validate({ body: updateProcessSchema }), updateProcess);
router.delete('/:id/processes/:processId', requireFactoryAccess('id'), deleteProcess);

export default router;
