import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { AppConfig } from '../models/appConfig.js';
import { verifyAccessToken } from '../lib/jwt.js';
import chroma from 'chroma-js';

const appConfig = new Hono();

// ── Schemas ─────────────────────────────────────────────
const appConfigUpdateSchema = z.object({
  pgName: z
    .string()
    .min(1, 'PG name is required')
    .max(100, 'PG name cannot exceed 100 characters')
    .optional(),
  tagline: z.string().max(200, 'Tagline cannot exceed 200 characters').optional(),
  logoUrl: z.string().optional(),
  heroImageUrl: z.string().optional(),
  address: z
    .object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      pincode: z.string().min(1),
    })
    .optional(),
  // FE form state uses ''; treat empty as omitted optional
  phone: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string()
      .regex(/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number')
      .optional(),
  ),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().email('Invalid email').optional(),
  ),
  upiId: z.string().optional(),
  upiPayeeName: z.string().optional(),
  socialLinks: z
    .object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      whatsapp: z.string().optional(),
      youtube: z.string().optional(),
    })
    .optional(),
  googleMapsEmbedUrl: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  roomPricing: z
    .object({
      sharing2: z.number().min(0),
      sharing3: z.number().min(0),
      sharing4: z.number().min(0),
    })
    .optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  primaryColorLight: z.string().optional(),
  primaryColorDark: z.string().optional(),
  landingHeroHeadline: z.string().max(200, 'Headline too long').optional(),
  landingHeroSubline: z.string().max(500, 'Subline too long').optional(),
  testimonials: z
    .array(
      z.object({
        name: z.string().min(1),
        occupation: z.string().optional(),
        rating: z.number().min(1).max(5),
        quote: z.string().min(1).max(500),
      }),
    )
    .optional(),
  termsAndConditions: z.string().max(10000).optional(),
  features: z
    .object({
      attendanceEnabled: z.boolean().optional(),
      laundryEnabled: z.boolean().optional(),
      messFeedbackEnabled: z.boolean().optional(),
      visitorManagementEnabled: z.boolean().optional(),
      guardianPortalEnabled: z.boolean().optional(),
      noticeBoardEnabled: z.boolean().optional(),
      emergencyAlertsEnabled: z.boolean().optional(),
    })
    .optional(),
  theme: z
    .object({
      preset: z.enum(['brutalist', 'neumorphic', 'soft-ui', 'saas', 'custom']).optional(),
      mode: z.enum(['light', 'dark']).optional(),
      brandColor: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
        .optional(),
      customTokens: z.record(z.string()).optional(),
      fonts: z
        .object({
          display: z.string().optional(),
          body: z.string().optional(),
          mono: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  // Admin settings fields previously stripped by Zod — must persist for FE settings UI
  gstNumber: z.string().max(20).optional(),
  panNumber: z.string().max(20).optional(),
  amenityDefinitions: z
    .array(
      z.object({
        key: z
          .string()
          .min(1)
          .regex(/^[a-z][a-z0-9_]*$/, 'Key must be lowercase alphanumeric with underscores'),
        label: z.string().min(1).max(50),
        icon: z.string().min(1),
        category: z.enum(['essential', 'appliance', 'furnishing', 'other']),
        showAsStatusLabel: z.boolean().optional().default(false),
        isPerFloor: z.boolean().optional().default(true),
        maxPerFloor: z.number().int().min(0).max(10).optional(),
        applicableComplaintCategories: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

// ── GET /app-config ─────────────────────────────────────
appConfig.get('/', async (c) => {
  const config = await AppConfig.findOne().lean();

  if (!config) {
    return c.json({
      success: true,
      data: { pgName: 'PG Management' },
    });
  }

  const data = { ...(config as unknown as Record<string, unknown>) };

  // Public callers: hide tax IDs. Admin JWT: return full settings (GST/PAN).
  let isAdmin = false;
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyAccessToken(authHeader.slice(7));
      isAdmin = payload.role === 'admin';
    } catch {
      isAdmin = false;
    }
  }
  if (!isAdmin) {
    delete data.gstNumber;
    delete data.panNumber;
  }

  return c.json({ success: true, data });
});

// ── PUT /app-config ─────────────────────────────────────
appConfig.put('/', authGuard, adminOnly, zValidator('json', appConfigUpdateSchema), async (c) => {
  const body = c.req.valid('json');

  if (body.theme?.brandColor) {
    const brandHex = body.theme.brandColor;
    const scale = chroma
      .scale([chroma(brandHex).brighten(2.5).hex(), brandHex, chroma(brandHex).darken(2.5).hex()])
      .mode('lch')
      .colors(11);

    const levels = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    const customTokens: Record<string, string> = body.theme.customTokens || {};
    levels.forEach((level, index) => {
      customTokens[`--color-brand-${level}`] = scale[index] || brandHex;
    });
    body.theme.customTokens = customTokens;
  }

  const config = await AppConfig.findOneAndUpdate(
    {}, // empty filter matches the singleton doc
    body,
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
    },
  ).lean();

  // Feature-flag middleware caches flags for 30s — bust on admin update
  const { invalidateFeatureFlagCache } = await import('../middleware/featureFlags.js');
  invalidateFeatureFlagCache();

  return c.json({ success: true, data: config });
});

export default appConfig;
