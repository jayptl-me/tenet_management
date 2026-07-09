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
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { tenantDisplayName, tenantRoomNumber } from '@/lib/api-shapes';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  month: z
    .string()
    .min(1, 'Month is required')
    .regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
});

type FormData = z.infer<typeof schema>;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: '',
      month: currentMonth(),
    },
  });

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
      setSubmitError(
        'Failed to generate invoice. The tenant may already have an invoice for this month.',
      );
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
            Generate Invoice
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Auto-generates rent and electricity from tenant and room data
          </p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4 text-sm text-[color:var(--color-text-secondary)]">
            Line items are calculated automatically from the tenant&apos;s monthly rent and any
            finalized electricity share for the selected month. To adjust amounts after generation,
            open the invoice and use Edit.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="tenantId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Tenant"
                  endpoint="tenants"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tenantId?.message}
                  placeholder="Select a tenant..."
                  valueKey="_id"
                  labelKey={(item: {
                    user?: { name?: string };
                    room?: { roomNumber?: string };
                    monthlyRent?: number;
                  }) =>
                    `${tenantDisplayName(item as never)} — Room ${tenantRoomNumber(item as never)}`
                  }
                  sublabelFn={(item: { monthlyRent?: number }) =>
                    item.monthlyRent != null ? `₹${item.monthlyRent}/mo` : ''
                  }
                  dataPath="data"
                />
              )}
            />
            <Input
              label="Month"
              placeholder="YYYY-MM"
              error={errors.month?.message}
              {...register('month')}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-[color:var(--border-color)] pt-5">
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
