/**
 * Operational error that maps to the API error contract:
 * { success: false, error: { code, message, details? } }
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Invalid input', details) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static invalidCredentials() {
    return new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, 'CONFLICT', message);
  }

  static serviceUnavailable(message = 'Service unavailable') {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message);
  }
}
