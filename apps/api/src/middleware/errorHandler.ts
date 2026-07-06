import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import { Error as MongooseError } from 'mongoose';
import logger from '../lib/logger.js';

export const globalErrorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') as string | undefined;
  const isProduction = process.env.NODE_ENV === 'production';

  if (err instanceof ZodError) {
    logger.warn({ requestId, errors: err.flatten().fieldErrors }, 'Validation error');
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          requestId,
          details: err.flatten().fieldErrors,
        },
      },
      400,
    );
  }

  if (err instanceof MongooseError.ValidationError) {
    logger.warn({ requestId, errors: err.errors }, 'Mongoose validation error');
    const details: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(err.errors)) {
      details[key] = [val.message];
    }
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Database validation failed',
          requestId,
          details,
        },
      },
      400,
    );
  }

  if (err instanceof MongooseError.CastError) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_ID',
          message: `Invalid ID format: ${err.value}`,
          requestId,
        },
      },
      400,
    );
  }

  logger.error({ err, requestId }, 'Unhandled error');

  if (isProduction) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          requestId,
        },
      },
      500,
    );
  }

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        requestId,
        stack: err instanceof Error ? err.stack : undefined,
      },
    },
    500,
  );
};
