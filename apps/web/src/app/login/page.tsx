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
      <div className="animate-fade-in-up w-full max-w-md rounded-[var(--radius-xl)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-8 shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-surface-900 text-3xl font-bold tracking-tight">
            Apex PG Management
          </h1>
          <p className="font-[family:var(--font-body)] text-surface-500 mt-2 text-sm">Sign in to your account</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-danger-500 bg-danger-100 text-danger-800 mb-6 rounded-[var(--radius-md)] border-[length:var(--bw-strong)] p-3">
            <p className="font-[family:var(--font-body)] text-sm font-semibold">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="admin@pgmanagement.local"
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
      </div>
    </div>
  );
}
