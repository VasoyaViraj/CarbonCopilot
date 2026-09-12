import prisma from '../db/db.js';
import { sendSuccess } from '../utils/response.js';

// Errors reach the central error handler, which returns the standard error envelope.
export const getAlternatives = async (req, res) => {
  const { category } = req.query;
  const alternatives = await prisma.circularAlternative.findMany(category ? { where: { category: String(category) } } : {});
  sendSuccess(res, { alternatives });
};
