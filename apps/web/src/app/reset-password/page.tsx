'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetFormData) => {
    if (!token) {
      setErrorMsg('Missing reset token');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      await api.post('auth/reset-password', { json: { token, password: data.password } }).json();
      setStatus('success');
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Reset link is invalid or has expired';
      setErrorMsg(message);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-bg)] p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-8 text-center shadow-[var(--shadow-lg)]"
        >
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">
            Password Reset Successful
          </h1>
          <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
            Redirecting you to login...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-bg)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-8 shadow-[var(--shadow-lg)]"
      >
        <div className="text-center">
          <KeyRound className="mx-auto mb-3 h-10 w-10 text-[color:var(--color-brand-500)]" />
          <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">
            Reset Your Password
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            Enter your new password below.
          </p>
        </div>

        {!token ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Invalid or missing reset token. Please request a new password reset.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter new password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Button type="submit" loading={status === 'submitting'} className="w-full">
              Reset Password
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-[color:var(--color-text-muted)]">
          <a href="/login" className="text-[color:var(--color-brand-500)] hover:underline">
            Back to login
          </a>
        </p>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-bg)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--color-brand-500)] border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
