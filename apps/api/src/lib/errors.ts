/**
 * Production-grade error system.
 *
 * Usage in routes:
 *   throw new ServiceUnavailableError('cloudinary');
 *   throw new ResourceNotFoundError('Tenant', tenantId);
 *   throw new ValidationError('Monthly rent must be at least 1000', { field: 'monthlyRent' });
 *
 * All AppError subclasses are caught by globalErrorHandler in middleware/errorHandler.ts
 * and converted to consistent JSON responses.
 */
import type { Context } from 'hono';

// ── Base Error Classes ──────────────────────────────────

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly publicMessage: string; // Always safe to show users

  constructor(
    message: string,
    status: number = 400,
    code: string = 'APP_ERROR',
    details?: Record<string, unknown>,
    publicMessage?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.publicMessage = publicMessage ?? message;
  }
}

// ── Domain-Specific Errors ──────────────────────────────

export class ResourceNotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `No ${resource} found with ID: ${id}` : `No ${resource} found`;
    super(message, 404, `${resource.toUpperCase()}_NOT_FOUND`, undefined, message);
    this.name = 'ResourceNotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(
      message,
      400,
      'VALIDATION_ERROR',
      fieldErrors ? { fields: fieldErrors } : undefined,
      message,
    );
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED', undefined, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN', undefined, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT', undefined, message);
    this.name = 'ConflictError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(serviceName: string, reason?: string) {
    const defaultReason = `${serviceName} service is not configured. Please contact your administrator to enable this feature.`;
    super(
      reason ?? defaultReason,
      503,
      'SERVICE_UNAVAILABLE',
      { service: serviceName },
      defaultReason,
    );
    this.name = 'ServiceUnavailableError';
  }
}

export class FeatureDisabledError extends AppError {
  constructor(feature: string) {
    const message = `${feature} is not enabled. Enable it from Settings > Features to access this functionality.`;
    super(message, 404, 'FEATURE_DISABLED', { feature }, message);
    this.name = 'FeatureDisabledError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number = 60) {
    const message = `Too many requests. Please try again in ${retryAfterSeconds} seconds.`;
    super(message, 429, 'RATE_LIMITED', { retryAfterSeconds }, message);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: Error) {
    const message = `Database operation failed: ${operation}. Our team has been notified.`;
    super(
      originalError?.message ?? message,
      500,
      'DATABASE_ERROR',
      { operation },
      'An unexpected database error occurred. Please try again later.',
    );
    this.name = 'DatabaseError';
  }
}

// ── Error Response Builder ──────────────────────────────

/**
 * Build a consistent JSON error response for any error type.
 * Used by globalErrorHandler but also usable directly in routes.
 */
export function buildErrorResponse(c: Context, err: unknown): Response {
  const requestId = c.get('requestId') as string | undefined;
  const isProduction = process.env.NODE_ENV === 'production';

  // Known application errors — full context
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      success: false,
      error: {
        code: err.code,
        message: err.publicMessage,
      },
    };
    if (requestId) (body.error as Record<string, unknown>).requestId = requestId;
    if (err.details) (body.error as Record<string, unknown>).details = err.details;
    if (!isProduction && err.message !== err.publicMessage) {
      (body.error as Record<string, unknown>).debugMessage = err.message;
    }
    return c.json(body, err.status as 200);
  }

  // Zod validation errors
  if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
    const zodErr = err as unknown as { flatten: () => { fieldErrors: Record<string, string[]> } };
    const fieldErrors = zodErr.flatten().fieldErrors;
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the highlighted fields and try again.',
          requestId,
          details: { fields: fieldErrors },
        },
      },
      400,
    );
  }

  // Mongoose validation errors
  if (err && typeof err === 'object' && 'name' in err && err.name === 'ValidationError') {
    const mongooseErr = err as unknown as { errors: Record<string, { message: string }> };
    const details: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(mongooseErr.errors)) {
      details[key] = [val.message];
    }
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the highlighted fields and try again.',
          requestId,
          details: { fields: details },
        },
      },
      400,
    );
  }

  // Mongoose cast errors (invalid ObjectId, etc.)
  if (err && typeof err === 'object' && 'name' in err && err.name === 'CastError') {
    const castErr = err as unknown as { value: unknown; path: string };
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: `Invalid value for "${castErr.path}". Please provide a valid identifier.`,
          requestId,
        },
      },
      400,
    );
  }

  // Unknown/unhandled errors
  if (isProduction) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Our team has been notified.',
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
        debugStack: err instanceof Error ? err.stack : undefined,
      },
    },
    500,
  );
}
