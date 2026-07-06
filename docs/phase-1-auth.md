# Phase 1: Authentication & User Management

**Status:** ✅ COMPLETE (07/06/2026)
**Goal:** Complete JWT auth flow (access + refresh token rotation), role-based access control (admin/tenant/guardian), admin seed on first boot, frontend login page with auth guard, Flutter auth flow.
**Estimated:** 3-4 days
**Depends On:** Phase 0 (foundation)
**Package Manager:** bun

---

## Architecture Decisions

| Decision              | Choice                                                                          | Rationale                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| JWT library           | `jose` (already in Phase 0 deps)                                                | Web Crypto API native, zero dependencies, bun-compatible                                                                             |
| Password hashing      | `bcryptjs` cost 12                                                              | Pure JS, no native bindings issues with bun                                                                                          |
| Refresh token storage | In-memory `Map<string, RefreshTokenMeta>` only — no DB persistence              | No DB round-trip for refresh, auto-cleared on restart (security), simple. Server restart = all users re-login (acceptable trade-off) |
| Auth middleware       | Hono custom middleware setting `c.get('user')`                                  | Follows Hono patterns, no decorator magic                                                                                            |
| Frontend auth state   | Zustand + persist (localStorage)                                                | Simple, typed, no context boilerplate                                                                                                |
| Rate limiting         | Custom in-memory rate limiter middleware                                        | Avoids extra dependency, sufficient for Render free tier                                                                             |
| Guardian auth         | Backend determines routing from `user.role` — no client-side role toggle needed | Login response includes role; Flutter routes by role automatically                                                                   |

---

## Step 1.1: User Mongoose Model

### File: `apps/api/src/models/user.ts`

```typescript
import mongoose, { type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { IUser, IUserRole } from '@pg/types/user';

const SALT_ROUNDS = 12;

// ── Schema ──────────────────────────────────────────────
export interface IUserDocument extends Omit<IUser, 'id'>, Document {
  passwordHash: string;
  comparePassword(candidate: string): Promise<boolean>;
  toPublicJSON(): Omit<IUserDocument, 'passwordHash'>;
}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      unique: true,
      match: [/^\+91[6-9]\d{9}$/, 'Phone must be +91 followed by 10 digits starting with 6-9'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'tenant', 'guardian'] as IUserRole[],
      default: 'tenant',
    },
    ntfyTopic: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      select: false, // Never exposed in API responses — used internally for push delivery only
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profilePhoto: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

// ── Indexes ─────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ ntfyTopic: 1 }, { unique: true });

// ── Pre-save hook: hash password if modified ────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();

  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    next();
  } catch (err) {
    next(err as Error);
  }
});

// ── Instance methods ────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toJSON();
  return obj;
};

// ── Static helpers ──────────────────────────────────────
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email }).select('+passwordHash');
};

userSchema.statics.findWithNtfyTopic = function (userId: string) {
  // Internal use only — fetches ntfyTopic for push delivery
  return this.findById(userId).select('+ntfyTopic').lean();
};

// ── Model export ────────────────────────────────────────
export const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema);
```

### Edge Cases Handled

| Edge Case                              | Behavior                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Duplicate email on create              | MongoDB unique index error → 409 Conflict with `DUPLICATE_EMAIL`                                 |
| Duplicate phone                        | 409 Conflict with `DUPLICATE_PHONE`                                                              |
| Inactive user login                    | 403 Forbidden `ACCOUNT_DEACTIVATED`                                                              |
| Password changed while tokens active   | All in-memory refresh tokens for user revoked — all sessions invalidated                         |
| Concurrent login from multiple devices | Supported — each device gets separate refresh token JTI in memory                                |
| Email case sensitivity                 | Stored lowercase, queried lowercase                                                              |
| Server restart                         | All refresh tokens cleared from memory — all users must re-login (acceptable)                    |
| ntfyTopic exposure                     | `select: false` prevents accidental leak. Use `findWithNtfyTopic()` only in notification service |

---

## Step 1.2: JWT Utility

### File: `apps/api/src/lib/jwt.ts`

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env.js';
import { v4 as uuidv4 } from 'uuid';
import type { IUserRole } from '@pg/types/user';

// ── Token Payload ───────────────────────────────────────
export interface AccessTokenPayload {
  sub: string; // user ID
  role: IUserRole;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // unique token ID for rotation tracking
  type: 'refresh';
}

// ── Encode secrets to Uint8Array for jose ───────────────
const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

// ── Generate Access Token ────────────────────────────────
export async function generateAccessToken(
  userId: string,
  role: IUserRole,
  email: string,
): Promise<string> {
  return new SignJWT({ sub: userId, role, email, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(accessSecret);
}

// ── Generate Refresh Token ──────────────────────────────
export async function generateRefreshToken(userId: string): Promise<{
  token: string;
  jti: string;
}> {
  const jti = uuidv4();
  const token = await new SignJWT({ sub: userId, jti, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRES_IN)
    .sign(refreshSecret);

  return { token, jti };
}

// ── Verify Access Token ─────────────────────────────────
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret, {
    algorithms: ['HS256'],
  });

  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return payload as unknown as AccessTokenPayload;
}

// ── Verify Refresh Token ────────────────────────────────
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    algorithms: ['HS256'],
  });

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return payload as unknown as RefreshTokenPayload;
}
```

---

## Step 1.3: Rate Limiter Middleware

### File: `apps/api/src/middleware/rateLimiter.ts`

```typescript
import type { MiddlewareHandler } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000).unref();

export function rateLimiter(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';

    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.res.headers.set('Retry-After', String(retryAfter));
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
```

---

## Step 1.4: Auth Middleware

### File: `apps/api/src/middleware/auth.ts`

```typescript
import type { MiddlewareHandler } from 'hono';
import type { IUserRole } from '@pg/types/user';
import { verifyAccessToken } from '../lib/jwt.js';

// Extend Hono's ContextVariableMap for type safety
declare module 'hono' {
  interface ContextVariableMap {
    user: {
      id: string;
      role: IUserRole;
      email: string;
    };
    requestId: string;
  }
}

// ── Require valid JWT ───────────────────────────────────
export const authGuard: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header',
          requestId: c.get('requestId'),
        },
      },
      401,
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    c.set('user', {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    });
    await next();
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired access token',
          requestId: c.get('requestId'),
        },
      },
      401,
    );
  }
};

// ── Require admin role ──────────────────────────────────
export const adminOnly: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  if (!user || user.role !== 'admin') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      },
      403,
    );
  }

  return next();
};

// ── Require tenant role ─────────────────────────────────
export const tenantOnly: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  if (!user || user.role !== 'tenant') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Tenant access required',
        },
      },
      403,
    );
  }

  return next();
};

// ── Require guardian role ───────────────────────────────
export const guardianOnly: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');

  if (!user || user.role !== 'guardian') {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Guardian access required' } },
      403,
    );
  }

  await next();
};

// ── Admin OR resource owner ─────────────────────────────
// Usage: selfOrAdmin(async (c) => { const res = await fetchOwner(c.req.param('id')); return res.ownerId; })
export function selfOrAdmin(getOwnerId: (c: any) => string | Promise<string>): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        401,
      );
    }

    if (user.role === 'admin') return next();

    const ownerId = await getOwnerId(c);
    if (user.id === ownerId) return next();

    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  };
}
```

---

## Step 1.5: Refresh Token Store (In-Memory Only)

### File: `apps/api/src/lib/refreshTokens.ts`

```typescript
interface RefreshTokenMeta {
  userId: string;
  jti: string;
  expiresAt: number; // epoch ms
}

// In-memory store — sole source of truth for refresh tokens
// Cleared on server restart: all users re-login (acceptable trade-off for simplicity)
const refreshTokenStore = new Map<string, RefreshTokenMeta>();

export function storeRefreshToken(userId: string, jti: string, ttlDays: number = 30): void {
  const expiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  refreshTokenStore.set(jti, { userId, jti, expiresAt });
}

export function validateRefreshToken(jti: string): RefreshTokenMeta | null {
  const meta = refreshTokenStore.get(jti);
  if (!meta) return null;
  if (meta.expiresAt <= Date.now()) {
    refreshTokenStore.delete(jti);
    return null;
  }
  return meta;
}

export function revokeRefreshToken(jti: string): void {
  refreshTokenStore.delete(jti);
}

export function revokeAllUserRefreshTokens(userId: string): void {
  for (const [jti, meta] of refreshTokenStore) {
    if (meta.userId === userId) {
      refreshTokenStore.delete(jti);
    }
  }
}

// Periodic cleanup of expired tokens (every hour)
setInterval(
  () => {
    const now = Date.now();
    for (const [jti, meta] of refreshTokenStore) {
      if (meta.expiresAt <= now) {
        refreshTokenStore.delete(jti);
      }
    }
  },
  60 * 60 * 1000,
).unref();
```

---

## Step 1.6: Auth Routes (In-Memory Refresh Token Store Only)

### File: `apps/api/src/routes/auth.ts`

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { authGuard } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import {
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from '../lib/refreshTokens.js';

const auth = new Hono();

// ── Schemas ─────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// ── POST /auth/login ────────────────────────────────────
auth.post('/login', rateLimiter(5, 15 * 60 * 1000), zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Find user with password hash
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      },
      401,
    );
  }

  // Check if active
  if (!user.isActive) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Account has been deactivated. Contact admin.',
        },
      },
      403,
    );
  }

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      },
      401,
    );
  }

  // Generate tokens
  const accessToken = await generateAccessToken(user._id.toString(), user.role, user.email);
  const { token: refreshToken, jti } = await generateRefreshToken(user._id.toString());

  // Store refresh token (in-memory only)
  storeRefreshToken(user._id.toString(), jti);

  // For tenants, include tenantId; for guardians, include guardianId
  let tenantId: string | undefined;
  let guardianId: string | undefined;

  if (user.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne({ userId: user._id, isActive: true }).select('_id').lean();
    tenantId = tenant?._id.toString();
  } else if (user.role === 'guardian') {
    const { Guardian } = await import('../models/guardian.js');
    const guardian = await Guardian.findOne({ userId: user._id, isActive: true })
      .select('_id')
      .lean();
    guardianId = guardian?._id.toString();
  }

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: user.toPublicJSON(),
      tenantId,
      guardianId,
    },
  });
});

// ── POST /auth/refresh ──────────────────────────────────
auth.post('/refresh', async (c) => {
  const body = await c.req.json();
  const { refreshToken } = body;

  if (!refreshToken) {
    return c.json(
      {
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Refresh token is required' },
      },
      400,
    );
  }

  try {
    const payload = await verifyRefreshToken(refreshToken);

    // Validate JTI hasn't been revoked (in-memory check)
    const stored = validateRefreshToken(payload.jti);
    if (!stored) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Refresh token has been revoked. Please login again.',
          },
        },
        401,
      );
    }

    // Rotation: revoke old JTI, issue new
    revokeRefreshToken(payload.jti);

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return c.json(
        {
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found or deactivated' },
        },
        401,
      );
    }

    const accessToken = await generateAccessToken(user._id.toString(), user.role, user.email);
    const { token: newRefreshToken, jti: newJti } = await generateRefreshToken(user._id.toString());

    storeRefreshToken(user._id.toString(), newJti);

    return c.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' },
      },
      401,
    );
  }
});

// ── POST /auth/logout ───────────────────────────────────
auth.post('/logout', authGuard, async (c) => {
  const userId = c.get('user').id;

  // Revoke all refresh tokens for this user
  revokeAllUserRefreshTokens(userId);

  return c.json({ success: true, data: { message: 'Logged out successfully' } });
});

// ── GET /auth/me ────────────────────────────────────────
auth.get('/me', authGuard, async (c) => {
  const userId = c.get('user').id;

  const user = await User.findById(userId);
  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      },
      404,
    );
  }

  // Include tenantId/guardianId for role-aware clients
  let tenantId: string | undefined;
  let guardianId: string | undefined;

  if (user.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne({ userId: user._id, isActive: true }).select('_id').lean();
    tenantId = tenant?._id.toString();
  } else if (user.role === 'guardian') {
    const { Guardian } = await import('../models/guardian.js');
    const guardian = await Guardian.findOne({ userId: user._id, isActive: true })
      .select('_id')
      .lean();
    guardianId = guardian?._id.toString();
  }

  return c.json({
    success: true,
    data: {
      ...user.toPublicJSON(),
      tenantId,
      guardianId,
    },
  });
});

// ── PUT /auth/password ──────────────────────────────────
auth.put('/password', authGuard, zValidator('json', changePasswordSchema), async (c) => {
  const userId = c.get('user').id;
  const { currentPassword, newPassword } = c.req.valid('json');

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      },
      404,
    );
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return c.json(
      {
        success: false,
        error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' },
      },
      400,
    );
  }

  user.passwordHash = newPassword; // Will be hashed by pre-save hook
  await user.save();

  // Revoke all in-memory tokens — force logout everywhere
  revokeAllUserRefreshTokens(userId);

  return c.json({ success: true, data: { message: 'Password changed. Please login again.' } });
});

export { auth as authRoutes };
```

### Auth Route Change Summary

| Aspect                    | Before (buggy)                                                 | After (fixed)                                                    |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Refresh token persistence | Dual: in-memory Map + `user.refreshTokens[]` DB array          | In-memory Map only. Server restart = force re-login (acceptable) |
| User model fields         | `refreshTokens: [String]` + `ntfyTopic` without `select:false` | No `refreshTokens` field. `ntfyTopic` has `select: false`        |
| Login response            | `{ accessToken, refreshToken, user }` — no tenant context      | `{ accessToken, refreshToken, user, tenantId?, guardianId? }`    |
| `/auth/me` response       | Just user profile                                              | User profile + `tenantId`/`guardianId` for role-aware routing    |
| Logout                    | Clears in-memory + DB array                                    | Only in-memory revoke (no DB to clear)                           |
| Password change           | Sets `user.refreshTokens = []` + in-memory revoke              | Only in-memory revoke (no DB field)                              |
| Guardian auth UX          | Undefined role toggle on client                                | Backend `user.role` determines routing — no client toggle needed |

---

## Step 1.7: Admin Seed Script

### File: `apps/api/src/scripts/seed.ts`

```typescript
import mongoose from 'mongoose';
import { env } from '../lib/env.js';
import { User } from '../models/user.js';
import { logger } from '../lib/logger.js';

async function seed() {
  await mongoose.connect(env.MONGODB_URI);

  // ── Check if admin exists ────────────────────────────
  const existingAdmin = await User.findOne({ email: env.ADMIN_EMAIL });

  if (existingAdmin) {
    logger.info('Admin user already exists, skipping seed');
    await mongoose.disconnect();
    return;
  }

  // ── Create admin ─────────────────────────────────────
  const admin = new User({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    phone: env.ADMIN_PHONE,
    passwordHash: env.ADMIN_PASSWORD, // Will be hashed by pre-save hook
    role: 'admin',
    isActive: true,
  });

  await admin.save();
  logger.info({ email: env.ADMIN_EMAIL }, 'Admin user created');

  await mongoose.disconnect();
  logger.info('Seed complete');
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
```

Run via: `bun run src/scripts/seed.ts` (or `bun run --filter @pg/api seed`)

---

## Step 1.8: Add Auth Routes to App Index

In `apps/api/src/index.ts`, add after the health check route:

```typescript
import { authRoutes } from './routes/auth.js';

// ...after api.get('/health', ...):
api.route('/auth', authRoutes);
```

---

## Step 1.9: Frontend Login Page

### File: `apps/web/src/app/login/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      router.push('/admin/dashboard');
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-100 flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader className="space-y-1 text-center">
            <div className="bg-brand-500 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <CardTitle className="font-display text-2xl">PG Management</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@pg.com"
                  autoComplete="email"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-danger-500 text-sm">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <p className="text-danger-500 text-sm">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
```

---

## Step 1.10: Admin Layout Auth Guard

### File: `apps/web/src/app/(admin)/layout.tsx`

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-brand-500 h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

---

## Step 1.11: `.env.example` for API

### File: `apps/api/.env.example`

```bash
# ── Server ───────────────────────────────────────────────
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ── MongoDB ──────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/pgdb?retryWrites=true&w=majority

# ── JWT Secrets (generate with: openssl rand -hex 32) ───
JWT_ACCESS_SECRET=your-256-bit-access-secret-here-change-in-production
JWT_REFRESH_SECRET=your-256-bit-refresh-secret-here-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ── Cloudinary ───────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ── Resend ───────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@pgmanagement.in

# ── Admin Seed ───────────────────────────────────────────
ADMIN_EMAIL=admin@pgmanagement.in
ADMIN_PASSWORD=ChangeMe123!
ADMIN_NAME=Administrator
ADMIN_PHONE=+919999999999

# ── ntfy ─────────────────────────────────────────────────
NTFY_BASE_URL=https://ntfy.sh
NTFY_SELF_HOSTED=false

# ── UPI ──────────────────────────────────────────────────
DEFAULT_UPI_ID=pgowner@okhdfcbank
DEFAULT_UPI_PAYEE_NAME=PG Management

# ── ChromaJS Cache ───────────────────────────────────────
CHROMA_CACHE_TTL=86400
```

---

## Step 1.12: Flutter Auth Flow

### Key Architecture Decisions

| Component        | Choice                                                                        | Why                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| State management | Riverpod AsyncNotifier                                                        | Typed, testable, auto-dispose                                                                                                                    |
| Token storage    | flutter_secure_storage                                                        | Encrypted, platform-native (Keychain/Keystore)                                                                                                   |
| HTTP client      | Dio with interceptor                                                          | Auto-refresh, error mapping. Refresh interceptor uses a Completer-based queue to prevent concurrent refresh race conditions                      |
| Routing guard    | go_router redirect                                                            | Declarative, reactive to auth state                                                                                                              |
| Role routing     | Login response `user.role` determines navigation — no client-side role toggle | Backend is authoritative. Admin users are rejected on mobile (direct to web). Tenant → tenant dashboard. Guardian → guardian read-only dashboard |

### Dio Refresh Interceptor (Completer-Based Queue)

```dart
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class RefreshInterceptor extends Interceptor {
  final Dio _dio;
  final FlutterSecureStorage _storage;
  Completer<String?>? _refreshCompleter;

  RefreshInterceptor(this._dio, this._storage);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    // Queue concurrent refresh requests instead of rejecting them
    if (_refreshCompleter != null) {
      final newToken = await _refreshCompleter!.future;
      if (newToken != null) {
        return _retry(err, newToken, handler);
      }
      return handler.next(err);
    }

    _refreshCompleter = Completer<String?>();

    try {
      final refreshToken = await _storage.read(key: 'refreshToken');
      final response = await _dio.post('/auth/refresh', data: {
        'refreshToken': refreshToken,
      });

      final newAccess = response.data['data']['accessToken'];
      final newRefresh = response.data['data']['refreshToken'];

      await _storage.write(key: 'accessToken', value: newAccess);
      await _storage.write(key: 'refreshToken', value: newRefresh);

      _refreshCompleter!.complete(newAccess);
      return _retry(err, newAccess, handler);
    } catch (e) {
      _refreshCompleter!.complete(null);
      await _storage.deleteAll();
      handler.next(err);
    } finally {
      _refreshCompleter = null;
    }
  }

  void _retry(DioException err, String token, ErrorInterceptorHandler handler) async {
    err.requestOptions.headers['Authorization'] = 'Bearer $token';
    try {
      final response = await _dio.fetch(err.requestOptions);
      handler.resolve(response);
    } catch (e) {
      handler.next(err);
    }
  }
}
```

### Auth Provider (`mobile/lib/features/auth/providers/auth_provider.dart`)

```dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

class AuthState {
  final String? accessToken;
  final String? refreshToken;
  final Map<String, dynamic>? user;
  final String? tenantId;
  final String? guardianId;
  final bool isAuthenticated;

  const AuthState({
    this.accessToken,
    this.refreshToken,
    this.user,
    this.tenantId,
    this.guardianId,
    this.isAuthenticated = false,
  });

  AuthState copyWith({...}) => AuthState(...);
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  // Full implementation: login(), logout(), refreshToken(), hydrate()
  // Dio interceptor for auto-refresh (Completer-based queue above)
  // go_router redirect integration
  // Role routing: admin users rejected on mobile
}
```

_(Full Dart implementation in Phase 8 — Flutter App)_

---

## Verification Checklist

- [ ] `POST /api/v1/auth/login` with correct admin credentials → returns tokens + user
- [ ] `POST /api/v1/auth/login` with wrong password → 401 `INVALID_CREDENTIALS`
- [ ] `POST /api/v1/auth/login` with inactive user → 403 `ACCOUNT_DEACTIVATED`
- [ ] Login response includes `tenantId` for tenant users, `guardianId` for guardian users
- [ ] Rate limit: 6 rapid login attempts from same IP → 429 on 6th attempt
- [ ] `GET /api/v1/auth/me` with valid access token → returns user profile with tenantId/guardianId
- [ ] `GET /api/v1/auth/me` with expired token → 401, frontend auto-refreshes
- [ ] `POST /api/v1/auth/refresh` with valid refresh token → new access + refresh tokens
- [ ] `POST /api/v1/auth/refresh` with revoked token → 401 `TOKEN_REVOKED`
- [ ] Server restart: all refresh tokens cleared, users must re-login
- [ ] `PUT /api/v1/auth/password` with correct current password → password changed, all sessions invalidated
- [ ] `POST /api/v1/auth/logout` → all refresh tokens revoked
- [ ] ntfyTopic is NOT returned in any `/auth/me` or user response (verify `select: false`)
- [ ] Admin seed: first boot with no admin → admin created from env vars
- [ ] Admin seed: second boot → "admin already exists" skip
- [ ] Frontend: login page renders, motion animation plays
- [ ] Frontend: login redirects to /admin/dashboard on success
- [ ] Frontend: invalid token auto-redirects to /login
- [ ] Frontend: concurrent 401s → refresh queued (Completer), only one refresh call made
- [ ] Frontend: page refresh with valid token → hydrate() restores session
- [ ] Flutter: Dio refresh interceptor queues concurrent 401s correctly
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes (all auth-related tests)

---

## Edge Cases Covered

| Scenario                                | Handling                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Token expired during long request       | ky interceptor catches 401, refreshes, retries original request                                               |
| Multiple concurrent 401s (Flutter)      | Completer-based queue — second request waits for first refresh to complete                                    |
| Multiple tabs: one logs out             | Other tabs' next API call gets 401, refresh fails (token revoked), redirects to login                         |
| Server restart clears refresh tokens    | User must re-login (acceptable for security — tokens are ephemeral)                                           |
| Email already exists (case-insensitive) | MongoDB unique index error caught → 409                                                                       |
| Phone number format                     | Zod regex `/^\+91[6-9]\d{9}$/` — must have country code                                                       |
| Password change during active session   | All refresh tokens revoked, user forced to re-login                                                           |
| Brute force login                       | Rate limited: 5 attempts per 15 min per IP                                                                    |
| Guardian user opens tenant-only action  | Backend role middleware returns 403, Flutter hides entry points                                               |
| Admin user opens Flutter app            | Rejected — admin users directed to web admin panel                                                            |
| ntfyTopic leak in API responses         | `select: false` prevents accidental exposure; only notification service accesses it via `findWithNtfyTopic()` |
