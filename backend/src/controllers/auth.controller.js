import { env } from '../config/env.js';
import { authenticateUser, registerUser } from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';

const AUTH_COOKIE = 'token';
const cookieOptions = { httpOnly: true, secure: env.isProduction, sameSite: 'strict', path: '/' };

export const register = async (req, res) => {
  const result = await registerUser(req.body);
  res.cookie(AUTH_COOKIE, result.accessToken, cookieOptions);
  sendSuccess(res, result, 201);
};

export const login = async (req, res) => {
  const result = await authenticateUser(req.body);
  res.cookie(AUTH_COOKIE, result.accessToken, cookieOptions);
  sendSuccess(res, result);
};

export const me = (req, res) => {
  sendSuccess(res, { user: req.user });
};

export const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
  sendSuccess(res, { loggedOut: true });
};
