import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET is required and must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  // Shared secret for Express <-> AI service calls; empty disables the AI Copilot.
  AI_SERVICE_TOKEN: z
    .string()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => value === undefined || value.length >= 16, 'AI_SERVICE_TOKEN must be at least 16 characters when set'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(5),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // Hotspot severity thresholds as % of total emissions (BR-04).
  HOTSPOT_CRITICAL_PERCENT: z.coerce.number().gt(0).lt(100).default(40),
  HOTSPOT_HIGH_PERCENT: z.coerce.number().gt(0).lt(100).default(25),
  HOTSPOT_MEDIUM_PERCENT: z.coerce.number().gt(0).lt(100).default(10),
}).refine(
  (config) =>
    config.HOTSPOT_CRITICAL_PERCENT > config.HOTSPOT_HIGH_PERCENT && config.HOTSPOT_HIGH_PERCENT > config.HOTSPOT_MEDIUM_PERCENT,
  { path: ['HOTSPOT_CRITICAL_PERCENT'], message: 'Hotspot thresholds must satisfy CRITICAL > HIGH > MEDIUM' }
);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration (see backend/.env.example):');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.FRONTEND_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});
