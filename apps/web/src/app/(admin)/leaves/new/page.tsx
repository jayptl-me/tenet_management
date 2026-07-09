'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  fromDate: z.string().min(1, 'From date is required'),
  toDate: z.string().min(1, 'To date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

type FormData = z.infer<typeof schema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TenantOption { _id: string; user?: { name: string; phone: string }; room?: { roomNumber: string }; bedId?: string }

export default function NewLeavePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  });

  const err = errors as Record<string, { message?: string }>;

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
    <FormPage
      title="New Leave Application"
      description="Create a tenant leave request"
      backHref="/leaves"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/leaves"
            submitLabel="Save Leave"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Tenant"
                endpoint="tenants?isActive=true"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select tenant..."
                error={err.tenantId?.message}
                valueKey="_id"
                labelKey={(item) =>
                  (item as unknown as TenantOption).user?.name ?? 'Unknown'
                }
                sublabelFn={(item) =>
                  `Room ${(item as unknown as TenantOption).room?.roomNumber ?? 'N/A'}`
                }
                dataPath="data"
              />
            )}
          />
          <FormGrid>
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
          </FormGrid>
          <Textarea
            label="Reason"
            rows={4}
            placeholder="Reason for leave..."
            error={errors.reason?.message}
            {...register('reason')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}
