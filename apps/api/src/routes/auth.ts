import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { User } from '../models/user.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { createRefreshToken, rotateRefreshToken, revokeAllUserTokens } from '../lib/tokenStore.js';
import { authGuard } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../lib/logger.js';

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
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      },
      401,
    );
  }

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

auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
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

  return c.json({ success: true, data: user.toPublicJSON() });
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
