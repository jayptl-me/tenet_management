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
  month: z
    .string()
    .min(1, 'Month is required')
    .regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  dueDate: z.string().optional(),
  rentAmount: z.coerce.number().min(1, 'Rent amount is required'),
  electricityAmount: z.coerce.number().min(0, 'Must be >= 0'),
  otherCharges: z.coerce.number().min(0, 'Must be >= 0'),
});

type FormData = z.infer<typeof schema>;

export default function NewInvoicePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rentAmount: 0, electricityAmount: 0, otherCharges: 0 },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('invoices', { json: data }).json<{ success: boolean }>();
      router.push('/invoices');
    } catch {
      setSubmitError('Failed to create invoice. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Invoice</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Generate a new invoice for a tenant</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Tenant ID"
              placeholder="Enter tenant ID"
              error={errors.tenantId?.message}
              {...register('tenantId')}
            />
            <Input
              label="Month"
              placeholder="2026-01"
              error={errors.month?.message}
              {...register('month')}
            />
          </div>
          <Input
            label="Due Date"
            type="date"
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Rent Amount (₹)"
              type="number"
              error={errors.rentAmount?.message}
              {...register('rentAmount')}
            />
            <Input
              label="Electricity (₹)"
              type="number"
              error={errors.electricityAmount?.message}
              {...register('electricityAmount')}
            />
            <Input
              label="Other Charges (₹)"
              type="number"
              error={errors.otherCharges?.message}
              {...register('otherCharges')}
            />
          </div>
        </div>
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}
