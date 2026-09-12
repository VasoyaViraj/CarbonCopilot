import express from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { loginRateLimit, registerRateLimit } from '../middleware/security.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { loginSchema, registerSchema } from '../validators/auth.validators.js';

const router = express.Router();

router.post('/register', registerRateLimit, validate({ body: registerSchema }), register);
router.post('/login', loginRateLimit, validate({ body: loginSchema }), login);
router.get('/me', authenticate, me);
router.post('/logout', logout);

export default router;
