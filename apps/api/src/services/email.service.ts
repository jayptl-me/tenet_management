/**
 * Email service — sends transactional emails via Resend.
 */
import { Resend } from 'resend';
import { env } from '../lib/env.js';
import { isServiceAvailable } from '../lib/serviceAvailability.js';
import { logger } from '../lib/logger.js';

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (resendClient) return resendClient;
  if (!isServiceAvailable('resend')) {
    logger.warn('Resend not configured — emails will not be sent');
    return null;
  }
  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Send a password reset email with a reset link.
 * Falls back to logging the reset URL when Resend is unavailable.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  name: string,
): Promise<{ sent: boolean; resetUrl: string }> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const client = getClient();

  if (!client) {
    // Fallback: log the reset URL so admin can use it in dev
    logger.info(
      { email, resetUrl },
      'Password reset requested (email not sent — Resend unavailable)',
    );
    return { sent: false, resetUrl };
  }

  try {
    await client.emails.send({
      from: `PG Management <noreply@${new URL(env.FRONTEND_URL).hostname}>`,
      to: email,
      subject: 'Reset your PG Management password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>Hi ${name},</p>
          <p>You requested a password reset. Click the link below to set a new password. This link expires in 1 hour.</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr />
          <p style="color: #6b7280; font-size: 12px;">If the button doesn't work, copy this URL: ${resetUrl}</p>
        </div>
      `,
    });

    logger.info({ email }, 'Password reset email sent');
    return { sent: true, resetUrl };
  } catch (err) {
    logger.error({ err, email }, 'Failed to send password reset email');
    return { sent: false, resetUrl };
  }
}
