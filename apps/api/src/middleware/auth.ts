import type { MiddlewareHandler } from 'hono';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: AccessTokenPayload;
  }
}

export const authGuard: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header. Expected: Bearer <token>',
        },
      },
      401,
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    c.set('user', payload);
    await next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: `Invalid or expired token: ${message}`,
        },
      },
      401,
    );
  }
};
