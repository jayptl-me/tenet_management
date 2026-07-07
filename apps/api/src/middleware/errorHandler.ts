import type { ErrorHandler } from 'hono';
import logger from '../lib/logger.js';
import { buildErrorResponse, AppError } from '../lib/errors.js';

export const globalErrorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') as string | undefined;

  // Log all errors with context
  if (err instanceof AppError) {
    logger.warn(
      { err, requestId, code: err.code, status: err.status },
      'Application error caught',
    );
  } else {
    logger.error({ err, requestId }, 'Unhandled error');
  }

  // Delegate to the unified error response builder
  return buildErrorResponse(c, err);
};
