import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  /** Admin Next.js app origin (password reset links, admin CORS). */
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  /**
   * Flutter portal origin (tenant/guardian/visitor) for production CORS.
   * In development, any localhost origin is also allowed (see cors-origins.ts).
   */
  PORTAL_URL: z.string().url().optional(),
  /**
   * Comma-separated extra CORS origins (e.g. preview deploys).
   * Example: https://preview.example.com,https://portal-staging.example.com
   */
  CORS_EXTRA_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).default('demo'),
  CLOUDINARY_API_KEY: z.string().min(1).default('demo'),
  CLOUDINARY_API_SECRET: z.string().min(1).default('demo'),
  RESEND_API_KEY: z.string().min(1).default('re_demo'),
  ADMIN_EMAIL: z.string().email().default('admin@pgmanagement.local'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin1234!'),
  ADMIN_NAME: z.string().default('PG Admin'),
  ADMIN_PHONE: z.string().default('+910000000000'),
  CHROMA_CACHE_TTL: z.coerce.number().default(86400),
  UPTIMEROBOT_API_KEY: z.string().optional(),
  CRON_SECRET: z
    .string()
    .min(16, 'CRON_SECRET must be at least 16 characters')
    .default('dev-cron-secret-change-me-key'),
  RATE_LIMIT_ENABLED_IN_DEV: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /**
   * IANA timezone for resident-facing business dates (attendance day,
   * today's menu, check-in window). Defaults to India Standard Time.
   */
  PG_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),
  NTFY_BASE_URL: z.string().url().default('https://ntfy.sh'),
  NTFY_SELF_HOSTED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
