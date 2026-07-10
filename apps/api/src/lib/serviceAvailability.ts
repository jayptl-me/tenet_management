/**
 * Service availability checker — validates external service configuration at startup.
 * Returns status for each service so routes can gracefully degrade instead of crashing.
 */
import { env } from './env.js';
import logger from './logger.js';

export interface ServiceStatus {
  name: string;
  available: boolean;
  reason?: string;
}

let _statuses: ServiceStatus[] | null = null;

/**
 * Run once at startup. Checks all external service configurations.
 * Does NOT throw — missing services return { available: false, reason }.
 */
export function checkServiceAvailability(): ServiceStatus[] {
  if (_statuses) return _statuses;

  const statuses: ServiceStatus[] = [];

  // Cloudinary
  const cloudinaryConfigured =
    env.CLOUDINARY_CLOUD_NAME !== 'demo' &&
    env.CLOUDINARY_API_KEY !== 'demo' &&
    env.CLOUDINARY_API_SECRET !== 'demo';

  statuses.push({
    name: 'cloudinary',
    available: cloudinaryConfigured,
    reason: cloudinaryConfigured
      ? undefined
      : 'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET not configured. Document uploads and image storage will be unavailable.',
  });

  // Resend (email)
  const resendConfigured = env.RESEND_API_KEY !== 're_demo';
  statuses.push({
    name: 'resend',
    available: resendConfigured,
    reason: resendConfigured
      ? undefined
      : 'RESEND_API_KEY not configured. Email notifications will be unavailable.',
  });

  // ntfy.sh
  statuses.push({
    name: 'ntfy',
    available: true, // Always available — uses public ntfy.sh or self-hosted
  });

  // MongoDB (checked separately via db.ts connection)
  statuses.push({
    name: 'mongodb',
    available: true, // Validated during connectDatabase()
  });

  _statuses = statuses;

  // Log warnings for unavailable services
  for (const s of statuses) {
    if (!s.available) {
      logger.warn({ service: s.name, reason: s.reason }, 'Service unavailable');
    }
  }

  return statuses;
}

/**
 * Get current service status. Returns cached result from startup check.
 */
export function getServiceAvailability(): ServiceStatus[] {
  if (!_statuses) return checkServiceAvailability();
  return _statuses;
}

/**
 * Check if a specific service is available.
 */
export function isServiceAvailable(serviceName: string): boolean {
  const status = getServiceAvailability().find((s) => s.name === serviceName);
  return status?.available ?? false;
}

/**
 * Middleware-style helper: returns an error response if the service is unavailable.
 * Usage in routes: checkServiceOrFail(c, 'cloudinary') returns error response or null.
 */
export function serviceUnavailableError(serviceName: string): {
  code: string;
  message: string;
} | null {
  if (isServiceAvailable(serviceName)) return null;

  const status = getServiceAvailability().find((s) => s.name === serviceName);
  return {
    code: 'SERVICE_UNAVAILABLE',
    message:
      status?.reason ?? `${serviceName} is not configured. Please contact your administrator.`,
  };
}
