/**
 * Feature flag middleware tests -- validates that requireFeature returns
 * 403 FEATURE_DISABLED when a flag is off, and allows requests through
 * when the flag is on. Uses a minimal Hono app with the middleware.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requireFeature, invalidateFeatureFlagCache } from '../middleware/featureFlags.js';
import { AppConfig } from '../models/appConfig.js';

type AnyDoc = Record<string, unknown>;
const configCreate = AppConfig.create.bind(AppConfig) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

const baseConfig: AnyDoc = {
  pgName: 'Test PG',
  address: { line1: '123 Test St', city: 'Test City', state: 'TS', pincode: '123456' },
  phone: '+919876543210',
  email: 'test@test.com',
  roomPricing: { sharing2: 5000, sharing3: 4000, sharing4: 3000 },
};

const allFeaturesOn: AnyDoc = {
  attendanceEnabled: false,
  laundryEnabled: true,
  messFeedbackEnabled: true,
  visitorManagementEnabled: true,
  guardianPortalEnabled: true,
  noticeBoardEnabled: true,
  emergencyAlertsEnabled: true,
};

describe('Feature Flag Middleware', () => {
  beforeEach(() => {
    invalidateFeatureFlagCache();
  });

  it('should return 403 when visitorManagementEnabled is false', async () => {
    await configCreate({
      ...baseConfig,
      features: { ...allFeaturesOn, visitorManagementEnabled: false },
    });

    const app = new Hono();
    app.use('*', requireFeature('visitorManagementEnabled'));
    app.get('/', (c) => c.json({ success: true }));

    const res = await app.request('/');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FEATURE_DISABLED');
  });

  it('should allow access when visitorManagementEnabled is true', async () => {
    await configCreate({
      ...baseConfig,
      features: { ...allFeaturesOn, visitorManagementEnabled: true },
    });

    const app = new Hono();
    app.use('*', requireFeature('visitorManagementEnabled'));
    app.get('/', (c) => c.json({ success: true }));

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('should return 403 when messFeedbackEnabled is false', async () => {
    await configCreate({
      ...baseConfig,
      features: { ...allFeaturesOn, messFeedbackEnabled: false },
    });

    const app = new Hono();
    app.use('*', requireFeature('messFeedbackEnabled'));
    app.get('/', (c) => c.json({ success: true }));

    const res = await app.request('/');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('FEATURE_DISABLED');
  });

  it('should default to enabled when no AppConfig document exists', async () => {
    // No AppConfig created; visitorManagementEnabled defaults to true
    const app = new Hono();
    app.use('*', requireFeature('visitorManagementEnabled'));
    app.get('/', (c) => c.json({ success: true }));

    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});