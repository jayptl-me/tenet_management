'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  amount: z.coerce.number().min(1, 'Amount must be > 0'),
  type: z.enum(['rent', 'electricity', 'deposit', 'laundry', 'other']),
  method: z.enum(['upi', 'cash', 'bank_transfer', 'other']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TYPE_OPTIONS = [
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'other', label: 'Other' },
];

const METHOD_OPTIONS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export default function NewPaymentPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, notes: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('payments', { json: data }).json<{ success: boolean }>();
      router.push('/payments');
    } catch {
      setSubmitError('Failed to record payment. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Record Payment</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Enter a new payment transaction</p>
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
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Tenant"
                endpoint="tenants"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select tenant..."
                error={errors.tenantId?.message}
              />
            )}
          />
          <Input
            label="Amount (₹)"
            type="number"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Payment Type"
              options={TYPE_OPTIONS}
              error={errors.type?.message}
              {...register('type')}
            />
            <Select
              label="Payment Method"
              options={METHOD_OPTIONS}
              error={errors.method?.message}
              {...register('method')}
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
            Save Payment
          </Button>
        </div>
      </form>
    </div>
  );
}
