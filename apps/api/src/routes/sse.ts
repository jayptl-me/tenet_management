import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { MiddlewareHandler } from 'hono';
import { verifyAccessToken } from '../lib/jwt.js';
import { subscribe, unsubscribeAll } from '../lib/eventBus.js';
import { logger } from '../lib/logger.js';
import { randomUUID } from 'node:crypto';
import type { AccessTokenPayload } from '../lib/jwt.js';

const sseRoutes = new Hono();

// EventSource API doesn't support custom headers, so we accept token
// via query param in addition to the standard Authorization header.
const sseAuthGuard: MiddlewareHandler = async (c, next) => {
  // Try query param first (for EventSource), then fall back to header
  let token = c.req.query('token');

  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message:
            'Authentication required. Pass token as ?token= query param or Authorization header.',
        },
      },
      401,
    );
  }

  try {
    const payload: AccessTokenPayload = await verifyAccessToken(token);
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

/**
 * GET /api/v1/sse/admin
 *
 * Server-Sent Events endpoint for the admin panel.
 * Requires authentication and admin role.
 * Streams real-time events: new complaints, payment verifications, etc.
 */
sseRoutes.get('/admin', sseAuthGuard, (c) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required for SSE stream' },
      },
      403,
    );
  }

  const clientId = `admin-${user.sub}-${randomUUID()}`;

  logger.info({ clientId, userId: user.sub }, 'SSE client connected');

  return streamSSE(c, async (stream) => {
    // Subscribe to the event bus immediately so no broadcast events are dropped
    const unsubscribe = subscribe(clientId, (message) => {
      stream
        .writeSSE({
          event: message.event,
          data: JSON.stringify(message.data),
          id: String(Date.now()),
        })
        .catch((err) => {
          logger.error({ err, clientId }, 'Failed to write SSE message');
        });
    });

    // Send initial connection event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ message: 'SSE connection established', clientId }),
      id: String(Date.now()),
    });

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      stream
        .writeSSE({
          event: 'ping',
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        })
        .catch(() => {});
    }, 30_000);

    // Wait until the connection closes
    await new Promise<void>((resolve) => {
      let isCleanedUp = false;
      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        clearInterval(keepAlive);
        unsubscribe();
        unsubscribeAll(clientId);
        logger.info({ clientId }, 'SSE client disconnected');
        resolve();
      };

      if (c.req.raw.signal?.aborted) {
        cleanup();
        return;
      }

      stream.onAbort(cleanup);
      c.req.raw.signal?.addEventListener('abort', cleanup, { once: true });
    });
  });
});

export default sseRoutes;
