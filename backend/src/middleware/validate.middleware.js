import { ApiError } from '../utils/ApiError.js';

const toDetails = (issues) => issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));

/**
 * Validates req.body / req.params / req.query against zod schemas.
 * Parsed values are exposed on req.validated; req.body is replaced with the parsed body.
 */
export const validate = (schemas) => (req, res, next) => {
  req.validated = {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      throw ApiError.badRequest('Invalid input', toDetails(result.error.issues));
    }
    req.validated[key] = result.data;
  }
  if (req.validated.body) req.body = req.validated.body;
  next();
};
