'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
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

// This is the ADMIN-ONLY login page. It is not linked from the public website.
// Tenant and Guardian login/signup are served from separate pages:
//   /tenant/login  → TODO: point to Flutter web app when deployed
//   /guardian/login → TODO: point to Flutter web app when deployed
// The public landing page shows links to those, not to /login.

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setError(
          'This login is for administrators only. Tenants and guardians should use the respective portals.',
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
    <div className="bg-surface-50 flex min-h-screen items-center justify-center p-4">
      <div className="animate-fade-in-up w-full max-w-md rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-8 shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-surface-900 text-3xl font-bold tracking-tight">
            Admin Login
          </h1>
          <p className="font-[family:var(--font-body)] text-surface-500 mt-2 text-sm">
            Sign in to the admin panel
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-50)] p-4">
            <div className="flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-danger-600)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="font-[family:var(--font-body)] text-sm font-semibold text-[color:var(--color-danger-700)]">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="admin@pg.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            className="w-full"
          >
            <Lock className="h-4 w-4" />
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 border-t-[length:var(--bw-default)] border-t-[color:var(--border-color)] pt-4">
          <p className="text-surface-400 text-center font-mono text-[10px] font-medium uppercase tracking-wider">
            Administrator access only
          </p>
        </div>
      </div>
    </div>
  );
}
