import type { MiddlewareHandler } from 'hono';
import { env } from '../lib/env.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000,
).unref();

/**
 * Creates a rate limiter middleware.
 *
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimiter(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    // Skip rate limiting in development unless RATE_LIMIT_ENABLED_IN_DEV=true
    if (env.NODE_ENV === 'development' && !env.RATE_LIMIT_ENABLED_IN_DEV) {
      return next();
    }

    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';

    const key = `rate:${ip}:${c.req.path}`;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
      return next();
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Try again in ${retryAfter} seconds.`,
          },
        },
        429,
      );
    }

    return next();
  };
}

/**
 * Pre-configured rate limiters matching the spec:
 * - authLimiter: 5 requests per 15 minutes (brute force protection)
 * - generalLimiter: 300 requests per minute (general API)
 * - generalMutationLimiter: 30 requests per minute for POST/PUT/DELETE
 * - publicLimiter: 3 requests per hour (enquiry form spam protection)
 */
export const authLimiter = rateLimiter(5, 15 * 60 * 1000);
export const passwordResetLimiter = rateLimiter(3, 60 * 60 * 1000);
export const generalLimiter = rateLimiter(300, 60 * 1000);
export const publicLimiter = rateLimiter(3, 60 * 60 * 1000);

const _mutationLimiter = rateLimiter(30, 60 * 1000);

/**
 * Rate limiter that only applies to mutation methods (POST, PUT, DELETE, PATCH).
 * Allows 30 requests per minute per IP address.
 */
export const generalMutationLimiter: MiddlewareHandler = async (c, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method)) {
    return _mutationLimiter(c, next);
  }
  return next();
};
