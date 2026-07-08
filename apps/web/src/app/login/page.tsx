'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, KeyRound, AlertTriangle, ArrowRight, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
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

  // Theme-aware: read current theme preset for login page styling
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
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

      // Admin-only: reject tenant/guardian credentials
      if (user.role !== 'admin') {
        const roleLabel = user.role === 'tenant' ? 'Tenant' : user.role === 'guardian' ? 'Guardian' : user.role;
        setError(
          `This login is for administrators only. ${roleLabel}s should use the respective portal or mobile app.`,
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
        <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-8 shadow-[var(--shadow-card)]">
          {/* Brand Icon */}
          <motion.div
            variants={brandIcon}
            initial="hidden"
            animate={mounted ? 'visible' : 'hidden'}
            className="mb-6 flex justify-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-brand-100)] ring-2 ring-[color:var(--color-brand-200)] shadow-[var(--shadow-sm)]">
              <Building2 className="h-7 w-7 text-[color:var(--color-brand-600)]" />
            </div>
          </motion.div>

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="font-[family:var(--font-display)] text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
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
                  <p className="text-[13px] font-semibold text-[color:var(--color-danger-700)] leading-snug">
                    {error}
                  </p>
                  {error.includes('tenant') || error.includes('guardian') || error.includes('Tenant') || error.includes('Guardian') ? (
                    <p className="mt-1.5 text-[11px] font-medium text-[color:var(--color-danger-600)]">
                      Use the mobile app or tenant/guardian portal to access your account.
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
                onClick={() => setError('Please contact your system administrator to reset your password.')}
                className="text-[11px] font-semibold text-[color:var(--color-brand-600)] hover:text-[color:var(--color-brand-700)] transition-colors underline-offset-2 hover:underline"
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
                className="w-full group"
              >
                {isSubmitting ? (
                  <>Signing in...</>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In
                    <ArrowRight className="ml-auto h-4 w-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
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
            className="mt-6 border-t border-[color:var(--border-color)] pt-4 space-y-3"
          >
            {/* Demo admin login */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Fill form fields and submit programmatically
                const emailInput = document.getElementById('email') as HTMLInputElement;
                const passwordInput = document.getElementById('password') as HTMLInputElement;
                if (emailInput && passwordInput) {
                  emailInput.value = 'admin@pgmanagement.local';
                  passwordInput.value = 'Admin@123456';
                  // Trigger React controlled input change
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value'
                  )?.set;
                  nativeInputValueSetter?.call(emailInput, 'admin@pgmanagement.local');
                  nativeInputValueSetter?.call(passwordInput, 'Admin@123456');
                  emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
                  // Submit the form
                  handleSubmit(onSubmit)();
                }
              }}
              className="w-full text-[12px] font-semibold"
              size="sm"
            >
              🚀 Auto-fill Demo Admin
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-center">
              <KeyRound className="h-3 w-3 text-[color:var(--color-text-muted)]" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Administrator access only
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
