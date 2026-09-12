import { z } from 'zod';
import { SELF_REGISTRABLE_ROLES } from '../constants.js';

const email = z.string().trim().toLowerCase().email('Invalid email address').max(254);

// Strict objects: unknown keys (e.g. organization_id) are rejected rather than silently trusted.
export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email,
    // bcrypt only uses the first 72 bytes of a password.
    password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
    role: z
      .enum(SELF_REGISTRABLE_ROLES, { message: `Role must be one of: ${SELF_REGISTRABLE_ROLES.join(', ')}` })
      .default('FACTORY_OPERATOR'),
    organizationName: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(120).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();
