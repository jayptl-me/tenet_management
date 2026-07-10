'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relation: z.string().min(1, 'Relation is required'),
  isEmergencyContact: z.boolean(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const relationOptions = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
];

export default function EditGuardianPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`guardians/${id}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => {
        reset(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load guardian');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`guardians/${id}`, { json: data }).json();
      router.push('/guardians');
    } catch {
      setSubmitError('Failed to update guardian');
    }
  };

  return (
    <FormPage
      title="Edit Guardian"
      description="Update guardian contact details and flags"
      backHref="/guardians"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/guardians"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Linked tenant" description="Tenant this guardian is associated with">
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
                dataPath="data"
              />
            )}
          />
        </FormSection>

        <FormSection
          title="Contact details"
          description="Name, phone, email, and relation to the tenant"
          divided
        >
          <FormGrid>
            <Input label="Name" error={errors.name?.message} {...register('name')} />
            <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Select
              label="Relation"
              options={relationOptions}
              error={errors.relation?.message}
              {...register('relation')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Flags" description="Emergency contact and active status" divided>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            <Checkbox
              label="Emergency contact"
              error={errors.isEmergencyContact?.message}
              {...register('isEmergencyContact')}
            />
            <Checkbox label="Active" error={errors.isActive?.message} {...register('isActive')} />
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
