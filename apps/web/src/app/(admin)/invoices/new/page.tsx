'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  month: z
    .string()
    .min(1, 'Month is required')
    .regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  dueDate: z.string().optional(),
  rentAmount: z.coerce.number().min(1, 'Rent amount is required'),
  electricityAmount: z.coerce.number().min(0, 'Must be >= 0'),
  otherCharges: z.coerce.number().min(0, 'Must be >= 0'),
  totalAmount: z.coerce.number().min(0),
});

type FormData = z.infer<typeof schema>;

export default function NewInvoicePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: '',
      rentAmount: 0,
      electricityAmount: 0,
      otherCharges: 0,
      totalAmount: 0,
    },
  });

  // Watch line-item fields to auto-calculate total
  const rentAmount = watch('rentAmount');
  const electricityAmount = watch('electricityAmount');
  const otherCharges = watch('otherCharges');

  const totalAmount = (rentAmount || 0) + (electricityAmount || 0) + (otherCharges || 0);

  useEffect(() => {
    setValue('totalAmount', totalAmount);
  }, [totalAmount, setValue]);

  // When tenant is selected, fetch full tenant data and auto-fill monthly rent
  const onTenantChange = async (tenantId: string) => {
    if (!tenantId) return;
    try {
      const res = await api
        .get(`tenants/${tenantId}`)
        .json<{ success: boolean; data: { monthlyRent?: number } }>();
      if (res.data?.monthlyRent) {
        setValue('rentAmount', res.data.monthlyRent);
      }
    } catch {
      // Silently fail — user can still input rent manually
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api
        .post('invoices/generate-single', {
          json: { tenantId: data.tenantId, month: data.month },
        })
        .json<{ success: boolean }>();
      router.push('/invoices');
    } catch {
      setSubmitError('Failed to generate invoice. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">
            New Invoice
          </h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">
            Generate a new invoice for a tenant
          </p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          {/* Tenant Selection */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="tenantId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Tenant"
                  endpoint="tenants"
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val);
                    onTenantChange(val);
                  }}
                  error={errors.tenantId?.message}
                  placeholder="Select a tenant…"
                  valueKey="_id"
                  labelKey={(item: any) =>
                    `${item.user?.name ?? 'Unknown'} — Room ${item.room?.roomNumber ?? '?'}`
                  }
                  sublabelFn={(item: any) => `₹${item.monthlyRent}/mo`}
                  dataPath="data"
                />
              )}
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

          {/* Line-item Breakdown */}
          <div>
            <h3 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] mb-3 text-base font-bold">
              Line Items
            </h3>
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

          {/* Auto-calculated Total */}
          <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
            <div className="flex items-center justify-between">
              <span className="font-[family:var(--font-body)] text-[color:var(--color-text-secondary)] text-sm font-semibold">
                Total Amount
              </span>
              <span className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>
            <input type="hidden" {...register('totalAmount')} />
          </div>
        </div>

        <div className="border-[color:var(--border-color)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Generate Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}