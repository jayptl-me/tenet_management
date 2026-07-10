'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relation: z.enum(['father', 'mother', 'guardian', 'other']),
});

type FormData = z.infer<typeof schema>;

const RELATION_OPTIONS = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

export default function NewGuardianPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = { ...data, email: data.email || undefined };
    try {
      await api.post('guardians', { json: payload }).json<{ success: boolean }>();
      router.push('/guardians');
    } catch {
      setSubmitError('Failed to create guardian. Please try again.');
    }
  };

  return (
    <FormPage
      title="New Guardian"
      description="Add a guardian for a tenant"
      backHref="/guardians"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/guardians"
            submitLabel="Save Guardian"
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
              label="Name"
              placeholder="Full name"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Phone"
              placeholder="10-digit number"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </FormGrid>
          <FormGrid>
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Select
              label="Relation"
              options={RELATION_OPTIONS}
              error={errors.relation?.message}
              {...register('relation')}
            />
          </FormGrid>
        </div>
      </FormCard>
    </FormPage>
  );
}
