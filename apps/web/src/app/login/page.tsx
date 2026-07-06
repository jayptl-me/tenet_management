'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { ILoginRequest, IUserWithTokens } from '@pg/types';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
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

      login(response.data.user, response.data.accessToken, response.data.refreshToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-50 flex min-h-screen items-center justify-center p-4">
      <div className="animate-fade-in-up w-full max-w-md rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-8 shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-brand-600 text-3xl font-bold tracking-tight">
            PG Management
          </h1>
          <p className="font-body text-surface-500 mt-2 text-sm">Sign in to your account</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-danger-500 bg-danger-50 mb-6 rounded-lg border-[length:var(--bw-default)] p-3">
            <p className="font-body text-danger-700 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="font-body text-surface-700 block text-sm font-semibold"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="border-surface-300 bg-surface-50 font-body text-surface-900 placeholder:text-surface-400 focus:border-brand-500 mt-1.5 block w-full rounded-lg border-[length:var(--bw-default)] px-4 py-2.5 text-sm transition-colors duration-[var(--transition-duration)] focus:outline-none focus:ring-0"
              placeholder="admin@pgmanagement.local"
            />
            {errors.email && (
              <p className="font-body text-danger-600 mt-1 text-xs">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="font-body text-surface-700 block text-sm font-semibold"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="border-surface-300 bg-surface-50 font-body text-surface-900 placeholder:text-surface-400 focus:border-brand-500 mt-1.5 block w-full rounded-lg border-[length:var(--bw-default)] px-4 py-2.5 text-sm transition-colors duration-[var(--transition-duration)] focus:outline-none focus:ring-0"
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="font-body text-danger-600 mt-1 text-xs">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-500 font-body hover:bg-brand-600 w-full rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-button)] transition-all active:scale-[var(--active-press-scale)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
