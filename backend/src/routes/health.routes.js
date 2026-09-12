import express from 'express';
import prisma from '../db/db.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw ApiError.serviceUnavailable('Database unavailable');
  }
  sendSuccess(res, { status: 'ok', service: 'ecotrace-backend', database: 'up' });
});

export default router;
