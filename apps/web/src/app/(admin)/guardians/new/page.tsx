'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
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
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  email: z.string().email('Email is required for guardian login'),
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
  const [tempPassword, setTempPassword] = useState<string | null>(null);

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
    setTempPassword(null);
    const payload = {
      tenantId: data.tenantId,
      name: data.name.trim(),
      phone: normalizeInPhone(data.phone),
      email: data.email.trim().toLowerCase(),
      relation: data.relation,
    };
    try {
      const res = await api.post('guardians', { json: payload }).json<{
        success: boolean;
        data: { temporaryPassword?: string; _id?: string };
      }>();
      if (res.data.temporaryPassword) {
        setTempPassword(res.data.temporaryPassword);
      } else {
        router.push('/guardians');
      }
    } catch {
      setSubmitError(
        'Failed to create guardian. Check phone, unique email, and try again.',
      );
    }
  };

  return (
    <FormPage
      title="New Guardian"
      description="Add a guardian for a tenant (creates login credentials)"
      backHref="/guardians"
      error={submitError}
    >
      {tempPassword && (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] p-4">
          <p className="text-sm font-bold text-[color:var(--color-warning-800)]">
            Guardian created. Share this temporary password once (it will not be shown again):
          </p>
          <p className="mt-2 font-mono text-lg font-bold tracking-wide text-[color:var(--color-text-primary)]">
            {tempPassword}
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[color:var(--color-brand-600)] underline"
            onClick={() => router.push('/guardians')}
          >
            Continue to guardians list
          </button>
        </div>
      )}
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
              placeholder="+919876543210"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </FormGrid>
          <FormGrid>
            <Input
              label="Email (required for login)"
              type="email"
              placeholder="guardian@example.com"
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
