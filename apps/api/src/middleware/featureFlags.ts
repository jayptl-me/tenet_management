import type { MiddlewareHandler } from 'hono';
import { AppConfig } from '../models/appConfig.js';

export type FeatureFlagKey =
  | 'attendanceEnabled'
  | 'laundryEnabled'
  | 'messFeedbackEnabled'
  | 'visitorManagementEnabled'
  | 'guardianPortalEnabled'
  | 'noticeBoardEnabled'
  | 'emergencyAlertsEnabled';

let cache: { flags: Record<FeatureFlagKey, boolean>; expires: number } | null = null;
const CACHE_MS = 30_000;

async function loadFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.flags;

  const config = await AppConfig.findOne().select('features').lean();
  const features = (config as { features?: Record<string, boolean> } | null)?.features ?? {};

  const flags: Record<FeatureFlagKey, boolean> = {
    attendanceEnabled: features.attendanceEnabled ?? false,
    laundryEnabled: features.laundryEnabled ?? true,
    messFeedbackEnabled: features.messFeedbackEnabled ?? true,
    visitorManagementEnabled: features.visitorManagementEnabled ?? true,
    guardianPortalEnabled: features.guardianPortalEnabled ?? true,
    noticeBoardEnabled: features.noticeBoardEnabled ?? true,
    emergencyAlertsEnabled: features.emergencyAlertsEnabled ?? true,
  };

  cache = { flags, expires: now + CACHE_MS };
  return flags;
}

/** Invalidate feature-flag cache (call after AppConfig update). */
export function invalidateFeatureFlagCache(): void {
  cache = null;
}

/**
 * Require an AppConfig feature flag to be enabled.
 * Returns 403 FEATURE_DISABLED when off.
 */
export function requireFeature(flag: FeatureFlagKey): MiddlewareHandler {
  return async (c, next) => {
    const flags = await loadFlags();
    if (!flags[flag]) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FEATURE_DISABLED',
            message: `Feature "${flag}" is disabled in app configuration.`,
          },
        },
        403,
      );
    }
    return next();
  };
}
