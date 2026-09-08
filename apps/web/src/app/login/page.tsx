'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Lock,
  KeyRound,
  AlertTriangle,
  ArrowRight,
  Building2,
  Zap,
  X,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/auth';
import { parseApiError } from '@/lib/errorParser';
import type { ILoginRequest, IUserWithTokens } from '@pg/types';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ── Animations ─────────────────────────────────────────

const brandIcon = {
  hidden: { scale: 0, rotate: -15 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 20, delay: 0.1 },
  },
};

const formItem = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + i * 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

// ── Login Page ─────────────────────────────────────────

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Theme-aware: read current theme preset for login page styling
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address');
      return;
    }
    setForgotError(null);
    setForgotSubmitting(true);
    try {
      await api
        .post('auth/forgot-password', {
          json: { email: forgotEmail.trim().toLowerCase() },
        })
        .json();
      setForgotSuccess(true);
    } catch (err: unknown) {
      const parsed = await parseApiError(err);
      setForgotError(parsed.message || 'Failed to request password reset link');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await api
        .post('auth/login', { json: data as ILoginRequest })
        .json<{ success: true; data: IUserWithTokens }>();

      const { user, accessToken, refreshToken } = response.data;
      login(user, accessToken, refreshToken);

      // Web admin panel is admin-only. Tenant / guardian / visitor use the Flutter app.
      if (user.role !== 'admin') {
        const roleLabel =
          user.role === 'tenant' ? 'Tenant' : user.role === 'guardian' ? 'Guardian' : user.role;
        setError(
          `This login is for administrators only. ${roleLabel} accounts use the Tenet mobile / Flutter web portal.`,
        );
        useAuthStore.getState().logout();
        return;
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      const parsed = await parseApiError(err);
      setError(parsed.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[color:var(--color-surface-50)] p-4">
      {/* Decorative background blobs — theme-aware */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[color:var(--color-brand-500)] opacity-[0.04] blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[color:var(--color-accent-500)] opacity-[0.04] blur-3xl" />
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-8 shadow-[var(--shadow-card)]">
          {/* Brand Icon */}
          <motion.div
            variants={brandIcon}
            initial="hidden"
            animate={mounted ? 'visible' : 'hidden'}
            className="mb-6 flex justify-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-brand-100)] shadow-[var(--shadow-sm)] ring-2 ring-[color:var(--color-brand-200)]">
              <Building2 className="h-7 w-7 text-[color:var(--color-brand-600)]" />
            </div>
          </motion.div>

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-display font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Admin Login
            </h1>
            <p className="mt-1.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Sign in to the admin panel
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-4"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-danger-500)]" />
                <div>
                  <p className="text-[13px] leading-snug font-semibold text-[color:var(--color-danger-700)]">
                    {error}
                  </p>
                  {error.includes('Flutter') ||
                  error.includes('Tenant') ||
                  error.includes('Guardian') ? (
                    <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-danger-600)]">
                      Use the Flutter app under /mobile (web or mobile) for resident portals.
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <motion.div
              variants={formItem}
              custom={0}
              initial="hidden"
              animate={mounted ? 'visible' : 'hidden'}
            >
              <Input
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="admin@pg.com"
                error={errors.email?.message}
                {...register('email')}
              />
            </motion.div>

            <motion.div
              variants={formItem}
              custom={1}
              initial="hidden"
              animate={mounted ? 'visible' : 'hidden'}
            >
              <Input
                id="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                error={errors.password?.message}
                {...register('password')}
              />
            </motion.div>

            {/* Forgot password link */}
            <motion.div
              variants={formItem}
              custom={2}
              initial="hidden"
              animate={mounted ? 'visible' : 'hidden'}
              className="flex justify-end"
            >
              <button
                type="button"
                onClick={() => {
                  setForgotError(null);
                  setForgotSuccess(false);
                  setForgotEmail('');
                  setForgotOpen(true);
                }}
                className="text-[11px] font-semibold text-[color:var(--color-brand-600)] underline-offset-2 transition-colors hover:text-[color:var(--color-brand-700)] hover:underline"
              >
                Forgot password?
              </button>
            </motion.div>

            <motion.div
              variants={formItem}
              custom={3}
              initial="hidden"
              animate={mounted ? 'visible' : 'hidden'}
            >
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                className="group w-full"
              >
                {isSubmitting ? (
                  <>Signing in...</>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In
                    <ArrowRight className="ml-auto h-4 w-4 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Footer */}
          <motion.div
            variants={formItem}
            custom={4}
            initial="hidden"
            animate={mounted ? 'visible' : 'hidden'}
            className="mt-6 space-y-3 border-t border-[color:var(--border-color)] pt-4"
          >
            {/* Demo admin login */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Fill via react-hook-form state (not DOM hacks) so validation
                // sees the values on first click, then submit programmatically.
                setValue('email', 'admin@pgmanagement.local', { shouldValidate: true });
                setValue('password', 'Admin@123456', { shouldValidate: true });
                handleSubmit(onSubmit)();
              }}
              className="flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold"
              size="sm"
            >
              <Zap className="h-3.5 w-3.5" />
              Auto-fill Demo Admin
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-center">
              <KeyRound className="h-3 w-3 text-[color:var(--color-text-muted)]" />
              <p className="text-[10px] font-semibold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                Administrator access only
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {forgotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setForgotOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-start justify-between pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-600)]">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[color:var(--color-text-primary)]">
                      Reset Password
                    </h2>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      Receive recovery instructions via email
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="rounded-lg p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-100)] hover:text-[color:var(--color-text-primary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {forgotSuccess ? (
                <div className="space-y-4 py-2 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-success-100)] text-[color:var(--color-success-600)]">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                      Reset Link Dispatched
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                      If an account exists with this email address, a password reset link has been
                      sent. The link expires in 1 hour.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForgotOpen(false)}
                    className="w-full text-xs font-semibold"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4 pt-2">
                  <p className="text-xs text-[color:var(--color-text-secondary)]">
                    Enter the email address registered with your administrator account.
                  </p>

                  {forgotError && (
                    <div className="flex items-start gap-2 rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-3 text-xs text-[color:var(--color-danger-700)]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-danger-500)]" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <Input
                    label="Administrator Email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@pg.com"
                    autoFocus
                    required
                  />

                  <div className="flex gap-2.5 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForgotOpen(false)}
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={forgotSubmitting}
                      className="flex-1 text-xs"
                    >
                      Send Reset Link
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
