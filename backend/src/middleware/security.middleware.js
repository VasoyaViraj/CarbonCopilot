import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MINUTE = 60 * 1000;

/**
 * Hardening headers: nosniff, frame denial, strict CSP, HSTS, no referrer leakage.
 * The API only serves JSON and CSV downloads, so helmet's strict defaults are safe.
 */
export const securityHeaders = helmet();

// Rejections go through the central error handler so clients get the standard error envelope.
const limiter = ({ message, ...options }) =>
  rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(new ApiError(429, 'RATE_LIMITED', message)),
    ...options,
  });

/** Coarse per-IP ceiling for the whole API (flooding / scraping). */
export const apiRateLimit = limiter({
  windowMs: MINUTE,
  limit: env.API_RATE_LIMIT_MAX,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/** Brute-force / credential-stuffing protection: only failed sign-ins consume the budget. */
export const loginRateLimit = limiter({
  windowMs: 15 * MINUTE,
  limit: env.AUTH_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  message: 'Too many failed sign-in attempts. Try again in 15 minutes.',
});

/** Each registration creates an organization, so mass sign-ups are capped per IP. */
export const registerRateLimit = limiter({
  windowMs: 60 * MINUTE,
  limit: env.AUTH_RATE_LIMIT_MAX,
  message: 'Too many accounts created from this network. Try again later.',
});

/** Uploads are buffered in memory (up to MAX_UPLOAD_SIZE_MB each), so they get their own tighter budget. */
export const uploadRateLimit = limiter({
  windowMs: 15 * MINUTE,
  limit: 60,
  message: 'Too many uploads. Try again in a few minutes.',
});
