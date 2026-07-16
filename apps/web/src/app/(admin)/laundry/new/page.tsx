'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';
import { parseApiError } from '@/lib/errorParser';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 1 : v),
    z.coerce.number().int().min(1, 'At least 1 item'),
  ),
  notes: z.string().max(300, 'Notes cannot exceed 300 characters').optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewLaundrySlotPage() {
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
        .post('laundry-slots', { json: data })
        .json<{ success: boolean; data: { _id: string } }>();
      router.push('/laundry');
    } catch (err) {
      const parsed = await parseApiError(err);
      setSubmitError(
        parsed.code === 'DUPLICATE_SLOT'
          ? parsed.message
          : parsed.message || 'Failed to create laundry slot. Please try again.',
      );
    }
  };

  return (
    <FormPage
      title="New Laundry Slot"
      description="Book a laundry slot for a tenant"
      backHref="/laundry"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/laundry"
            submitLabel="Book Slot"
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
              label="Slot Date"
              type="date"
              error={errors.slotDate?.message}
              {...register('slotDate')}
            />
            <Input
              label="Slot Time"
              type="time"
              error={errors.slotTime?.message}
              {...register('slotTime')}
            />
          </FormGrid>

          <FormGrid>
            <Input
              label="Number of Items"
              type="number"
              placeholder="e.g., 5"
              error={errors.items?.message}
              {...register('items')}
            />
            <Textarea
              label="Notes (Optional)"
              rows={3}
              placeholder="Any special instructions..."
              error={errors.notes?.message}
              {...register('notes')}
            />
          </FormGrid>
        </div>
      </FormCard>
    </FormPage>
  );
}
