import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import crypto from 'node:crypto';
import { User } from '../models/user.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { createRefreshToken, rotateRefreshToken, revokeAllUserTokens } from '../lib/tokenStore.js';
import { authGuard } from '../middleware/auth.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../lib/logger.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

const auth = new Hono();

// ── Schemas ─────────────────────────────────────────────

const loginSchema = z.strictObject({
  email: z
    .string()
    .email('Invalid email format')
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const refreshSchema = z.strictObject({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const forgotPasswordSchema = z.strictObject({
  email: z
    .string()
    .email('Invalid email format')
    .transform((v) => v.toLowerCase().trim()),
});

const resetPasswordSchema = z.strictObject({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ── POST /auth/login ────────────────────────────────────

auth.post('/login', authLimiter, zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await User.findByEmail(email);
  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      },
      401,
    );
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    return c.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
        },
      },
      423,
    );
  }

  if (!user.isActive) {
    return c.json(
      {
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'This account has been deactivated.' },
      },
      403,
    );
  }

  const passwordValid = await user.comparePassword(password);
  if (!passwordValid) {
    await user.recordLoginFailed();
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      },
      401,
    );
  }

  await user.recordLoginSuccess();

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const jti = createRefreshToken(user.id);
  const refreshToken = await signRefreshToken({ sub: user.id, jti });

  logger.info({ userId: user.id, role: user.role }, 'User logged in');

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: user.toPublicJSON(),
    },
  });
});

// ── POST /auth/refresh ──────────────────────────────────

auth.post('/refresh', authLimiter, zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  let payload;
  try {
    const { verifyRefreshToken } = await import('../lib/jwt.js');
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token.' },
      },
      401,
    );
  }

  const result = rotateRefreshToken(payload.sub, payload.jti);
  if ('error' in result && result.error === 'REUSE_DETECTED') {
    revokeAllUserTokens(payload.sub);
    logger.warn({ userId: payload.sub }, 'Refresh token reuse detected — all tokens revoked');
    return c.json(
      {
        success: false,
        error: {
          code: 'TOKEN_REUSE_DETECTED',
          message: 'Token reuse detected. All sessions revoked for security.',
        },
      },
      401,
    );
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    return c.json(
      {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found or deactivated.' },
      },
      401,
    );
  }

  const newJti = 'newJti' in result ? result.newJti : createRefreshToken(payload.sub);
  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const newRefreshToken = await signRefreshToken({ sub: user.id, jti: newJti });

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

// ── POST /auth/logout ───────────────────────────────────

auth.post('/logout', authGuard, async (c) => {
  const user = c.get('user');
  const revoked = revokeAllUserTokens(user.sub);
  logger.info({ userId: user.sub, tokensRevoked: revoked }, 'User logged out');
  return c.json({ success: true, data: { message: 'Logged out successfully.' } });
});

// ── GET /auth/me ────────────────────────────────────────

auth.get('/me', authGuard, async (c) => {
  const authUser = c.get('user');
  const user = await User.findById(authUser.sub);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
      },
      404,
    );
  }

  const publicData = user.toPublicJSON() as Record<string, unknown>;

  // Enrich with tenantId for tenant role (P0-F1)
  // Self-heal legacy users whose tenantId was never backfilled by seed.
  if (user.role === 'tenant' && !publicData.tenantId) {
    try {
      const { Tenant } = await import('../models/tenant.js');
      const tenantDoc = await (Tenant as unknown as {
        findOne: (filter: Record<string, unknown>) => {
          select: (fields: string) => { lean: () => Promise<Record<string, unknown> | null> };
        };
      }).findOne({ userId: String(user._id), isActive: true })
        .select('_id')
        .lean();
      if (tenantDoc) {
        const tenantIdStr = String(tenantDoc._id);
        publicData.tenantId = tenantIdStr;
        // Self-heal: persist tenantId so future /auth/me calls skip the lookup
        user.tenantId = tenantIdStr;
        await user.save();
      }
    } catch {
      // Non-fatal — tenantId enrichment is best-effort
    }
  }

  return c.json({ success: true, data: publicData });
});

// ── POST /auth/forgot-password ───────────────────────────

auth.post(
  '/forgot-password',
  passwordResetLimiter,
  zValidator('json', forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid('json');

    const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      logger.info({ email }, 'Password reset requested for unknown/inactive user');
      return c.json({
        success: true,
        data: {
          message: 'If an account exists with this email, a password reset link has been sent.',
        },
      });
    }

    // Generate 32-byte random token (64 hex chars)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const { sent, resetUrl } = await sendPasswordResetEmail(email, resetToken, user.name);

    if (!sent) {
      logger.info({ email, resetUrl }, 'Password reset — email unavailable, URL logged');
    }

    return c.json({
      success: true,
      data: {
        message: 'If an account exists with this email, a password reset link has been sent.',
      },
    });
  },
);

// ── POST /auth/reset-password ────────────────────────────

auth.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const { token, password } = c.req.valid('json');

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_RESET_TOKEN',
          message: 'Reset token is invalid or has expired.',
        },
      },
      400,
    );
  }

  user.passwordHash = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Revoke all existing sessions for security
  revokeAllUserTokens(user.id);
  logger.info({ userId: user.id }, 'Password reset — all tokens revoked');

  return c.json({
    success: true,
    data: { message: 'Password reset successful. Please log in with your new password.' },
  });
});

// ── PUT /auth/password ──────────────────────────────────

auth.put('/password', authGuard, zValidator('json', changePasswordSchema), async (c) => {
  const authUser = c.get('user');
  const { currentPassword, newPassword } = c.req.valid('json');

  const user = await User.findById(authUser.sub);
  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
      },
      404,
    );
  }

  const passwordValid = await user.comparePassword(currentPassword);
  if (!passwordValid) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect.' },
      },
      400,
    );
  }

  user.passwordHash = newPassword;
  await user.save();

  revokeAllUserTokens(user.id);
  logger.info({ userId: user.id }, 'Password changed — all tokens revoked');

  return c.json({
    success: true,
    data: { message: 'Password changed successfully. Please log in again.' },
  });
});

export default auth;
