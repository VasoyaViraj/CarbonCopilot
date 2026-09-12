import { ApiError } from '../utils/ApiError.js';

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound('Route'));
};

function normalizeError(err) {
  if (err instanceof ApiError) return err;
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (err?.type === 'entity.too.large') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (err?.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') return ApiError.conflict('A record with these values already exists');
    if (err.code === 'P2025') return ApiError.notFound();
  }
  return null;
}

// Express identifies error handlers by their 4-argument signature.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let error = normalizeError(err);
  if (!error) {
    // Never leak stack traces or internals to clients.
    console.error(`[${req.id ?? '-'}] Unhandled error:`, err);
    error = new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }

  const body = { success: false, error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
};
