'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  visitorName: z.string().min(2, 'Visitor name must be at least 2 characters').max(100),
  visitorPhone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  purpose: z.string().min(1, 'Purpose is required').max(200),
  expectedArrival: z.string().min(1, 'Expected arrival is required'),
});

type FormData = z.infer<typeof schema>;

export default function NewVisitorPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api
        .post('visitors', {
          json: {
            tenantId: data.tenantId,
            visitorName: data.visitorName.trim(),
            visitorPhone: normalizeInPhone(data.visitorPhone),
            purpose: data.purpose.trim(),
            expectedArrival: new Date(data.expectedArrival).toISOString(),
          },
        })
        .json<{ success: boolean }>();
      router.push('/visitors');
    } catch {
      setSubmitError('Failed to register visitor. Check phone format (+91...) and try again.');
    }
  };

  return (
    <FormPage
      title="Register Visitor"
      description="Record a new visitor entry"
      backHref="/visitors"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/visitors"
            submitLabel="Register Visitor"
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
                endpoint="tenants"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select tenant..."
                error={errors.tenantId?.message}
                valueKey="_id"
                labelKey={tenantLabel}
                sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
              />
            )}
          />
          <FormGrid>
            <Input
              label="Visitor Name"
              placeholder="Full name"
              error={errors.visitorName?.message}
              {...register('visitorName')}
            />
            <Input
              label="Visitor Phone"
              placeholder="+919876543210"
              error={errors.visitorPhone?.message}
              {...register('visitorPhone')}
            />
          </FormGrid>
          <Input
            label="Purpose"
            placeholder="e.g. Family Visit, Delivery"
            error={errors.purpose?.message}
            {...register('purpose')}
          />
          <Input
            label="Expected Arrival"
            type="datetime-local"
            error={errors.expectedArrival?.message}
            {...register('expectedArrival')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}
