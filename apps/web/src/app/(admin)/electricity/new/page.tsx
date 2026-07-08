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
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  month: z
    .string()
    .min(1, 'Month is required')
    .regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  totalBillAmount: z.coerce.number().min(0, 'Must be >= 0'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewElectricityPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { totalBillAmount: 0, notes: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('electricity', { json: data }).json<{ success: boolean }>();
      router.push('/electricity');
    } catch {
      setSubmitError('Failed to create electricity bill. Please try again.');
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
            New Electricity Bill
          </h2>
          <p className="text-surface-500 mt-0.5 text-sm">Record a new electricity bill</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Month"
              placeholder="2026-01"
              error={errors.month?.message}
              {...register('month')}
            />
            <Input
              label="Total Amount (₹)"
              type="number"
              error={errors.totalBillAmount?.message}
              {...register('totalBillAmount')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-surface-800 font-display text-sm font-semibold">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Bill
          </Button>
        </div>
      </form>
    </div>
  );
}
