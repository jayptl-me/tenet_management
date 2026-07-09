'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
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
    <FormPage
      title="Generate Invoice"
      description="Auto-generates rent and electricity from tenant and room data"
      backHref="/invoices"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/invoices"
            submitLabel="Generate Invoice"
            divided={false}
          />
        }
      >
        <FormSection
          title="Invoice target"
          description="Line items are calculated from the tenant monthly rent and any finalized electricity share for the selected month. Open the invoice afterward to adjust amounts."
        >
          <FormGrid>
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
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
