import pino from 'pino';
import { env } from './env.js';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        },
  redact: ['password', 'passwordHash', 'token', 'secret', 'apiKey', '*.password', '*.secret'],
});

export { logger };

export function auditLog(action: string, details: Record<string, unknown>): void {
  logger.info({ type: 'audit', action, ...details }, `AUDIT: ${action}`);
}

export default logger;
