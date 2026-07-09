'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.enum(['upi', 'cash', 'bank_transfer', 'other']),
  type: z.enum(['rent', 'electricity', 'deposit', 'laundry', 'other']),
  status: z.enum(['pending', 'pending_verification', 'paid', 'overdue', 'cancelled']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`payments/${id}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => {
        reset(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load payment');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`payments/${id}`, { json: data }).json();
      router.push('/payments');
    } catch {
      setSubmitError('Failed to update payment');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
            Edit Payment
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Update payment details
          </p>
        </div>
      </div>
      {submitError && <ErrorBanner message={submitError} />}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Select
            label="Method"
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'upi', label: 'UPI' },
              { value: 'other', label: 'Other' },
            ]}
            error={errors.method?.message}
            {...register('method')}
          />
          <Select
            label="Type"
            options={[
              { value: 'rent', label: 'Rent' },
              { value: 'deposit', label: 'Deposit' },
              { value: 'electricity', label: 'Electricity' },
              { value: 'laundry', label: 'Laundry' },
              { value: 'other', label: 'Other' },
            ]}
            error={errors.type?.message}
            {...register('type')}
          />
          <Select
            label="Status"
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'pending_verification', label: 'Pending verification' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            error={errors.status?.message}
            {...register('status')}
          />
          <Input label="Notes" error={errors.notes?.message} {...register('notes')} />
        </div>
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
