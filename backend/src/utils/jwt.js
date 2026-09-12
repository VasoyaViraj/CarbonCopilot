import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Pinned algorithm: tokens using any other algorithm (including "none") are rejected.
const ALGORITHM = 'HS256';

export const signAccessToken = (user) =>
  jwt.sign({ role: user.role, org: user.organization_id }, env.JWT_SECRET, {
    subject: String(user.id),
    algorithm: ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
