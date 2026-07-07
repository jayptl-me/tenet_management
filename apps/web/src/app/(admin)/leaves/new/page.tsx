'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  fromDate: z.string().min(1, 'From date is required'),
  toDate: z.string().min(1, 'To date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

type FormData = z.infer<typeof schema>;

export default function NewLeavePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('leaves', { json: data }).json<{ success: boolean }>();
      router.push('/leaves');
    } catch {
      setSubmitError('Failed to create leave application. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            New Leave Application
          </h2>
          <p className="text-surface-500 mt-0.5 text-sm">Create a tenant leave request</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <Input
            label="Tenant ID"
            placeholder="Enter tenant ID"
            error={errors.tenantId?.message}
            {...register('tenantId')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="From Date"
              type="date"
              error={errors.fromDate?.message}
              {...register('fromDate')}
            />
            <Input
              label="To Date"
              type="date"
              error={errors.toDate?.message}
              {...register('toDate')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="text-surface-800 font-display text-sm font-semibold">
              Reason
            </label>
            <textarea
              id="reason"
              rows={4}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Reason for leave..."
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-danger-600 text-sm font-medium">{errors.reason.message}</p>
            )}
          </div>
        </div>
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Leave
          </Button>
        </div>
      </form>
    </div>
  );
}
