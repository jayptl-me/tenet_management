'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
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
  phone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  relation: z.enum(['father', 'mother', 'guardian', 'other']),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const relationOptions = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

export default function EditGuardianPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [isEmergencyContact, setIsEmergencyContact] = useState(false);

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
      .json<{
        success: boolean;
        data: {
          tenantId?: string;
          name?: string;
          phone?: string;
          email?: string;
          relation?: string;
          isActive?: boolean;
          isEmergencyContact?: boolean;
        };
      }>()
      .then((res) => {
        const d = res.data;
        setIsEmergencyContact(!!d.isEmergencyContact);
        reset({
          tenantId: d.tenantId ?? '',
          name: d.name ?? '',
          phone: d.phone ?? '',
          email: d.email ?? '',
          relation: (d.relation as FormData['relation']) ?? 'other',
          isActive: d.isActive ?? true,
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load guardian');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    // Whitelist only fields accepted by updateGuardianSchema (strictObject)
    const payload = {
      name: data.name.trim(),
      phone: normalizeInPhone(data.phone),
      email: data.email || undefined,
      relation: data.relation,
      isActive: data.isActive,
    };
    try {
      await api.put(`guardians/${id}`, { json: payload }).json();
      router.push('/guardians');
    } catch {
      setSubmitError('Failed to update guardian. Check phone format (+91...) and try again.');
    }
  };

  return (
    <FormPage
      title="Edit Guardian"
      description="Update guardian contact details and active status"
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
                disabled
              />
            )}
          />
          <p className="mt-1 text-[12px] text-[color:var(--color-text-secondary)]">
            Tenant reassignment is not supported on update. Create a new guardian link if needed.
          </p>
        </FormSection>

        <FormSection
          title="Contact details"
          description="Name, phone, email, and relation to the tenant"
          divided
        >
          <FormGrid>
            <Input label="Name" error={errors.name?.message} {...register('name')} />
            <Input
              label="Phone"
              placeholder="+919876543210"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Controller
              name="relation"
              control={control}
              render={({ field }) => (
                <Select
                  label="Relation"
                  options={relationOptions}
                  error={errors.relation?.message}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Flags" description="Active status (emergency is derived from relation)" divided>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            <Checkbox
              label="Emergency contact (father/mother)"
              checked={isEmergencyContact}
              disabled
              onChange={() => undefined}
            />
            <Checkbox label="Active" error={errors.isActive?.message} {...register('isActive')} />
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
