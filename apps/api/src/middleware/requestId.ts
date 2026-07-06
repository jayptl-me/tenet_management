import { v4 as uuidv4 } from 'uuid';
import type { MiddlewareHandler } from 'hono';

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = uuidv4();
  c.set('requestId', id);
  c.res.headers.set('X-Request-Id', id);
  await next();
};
