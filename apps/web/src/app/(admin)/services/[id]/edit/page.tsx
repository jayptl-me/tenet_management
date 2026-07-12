'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { floorLabel } from '@/lib/resource-select-presets';

const schema = z.object({
  floorId: z.string().min(1, 'Floor is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  status: z.enum(['operational', 'degraded', 'down']),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const serviceTypeOptions = [
  { value: 'wifi', label: 'WiFi' },
  { value: 'water_supply', label: 'Water supply' },
  { value: 'power', label: 'Power' },
  { value: 'ac', label: 'Air conditioning' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'elevator', label: 'Elevator' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
];

const serviceStatusOptions = [
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
];

interface ServiceLoadShape {
  floorId?: string | { _id?: string };
  floor?: { _id?: string };
  serviceType?: string;
  status?: string;
  note?: string;
}

export default function EditServicePage() {
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
      .get(`services/${id}`)
      .json<{ success: boolean; data: ServiceLoadShape }>()
      .then((res) => {
        const d = res.data;
        const rawFloor = d.floorId ?? d.floor;
        const floorId =
          typeof rawFloor === 'object' && rawFloor
            ? String(rawFloor._id ?? '')
            : String(rawFloor ?? '');
        reset({
          floorId,
          serviceType: d.serviceType ?? '',
          status: (d.status as FormData['status']) ?? 'operational',
          note: d.note ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load service');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      // Full admin update path — status-only PUT rejects serviceType/floorId
      await api
        .put(`services/${id}/full`, {
          json: {
            serviceType: data.serviceType,
            status: data.status,
            note: data.note ?? '',
          },
        })
        .json();
      router.push('/services');
    } catch {
      setSubmitError('Failed to update service');
    }
  };

  return (
    <FormPage
      title="Edit Service Status"
      description="Update floor-level service status and notes"
      backHref="/services"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/services"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection
          title="Service"
          description="Floor, service type, and current operational status"
        >
          <FormGrid>
            <Controller
              name="floorId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Floor"
                  endpoint="floors"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select floor..."
                  error={errors.floorId?.message}
                  valueKey="_id"
                  labelKey={floorLabel}
                  dataPath="data"
                  disabled
                />
              )}
            />
            <Select
              label="Service type"
              options={serviceTypeOptions}
              error={errors.serviceType?.message}
              {...register('serviceType')}
            />
            <Select
              label="Status"
              options={serviceStatusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Notes" description="Optional context for staff" divided>
          <FormGrid cols={1}>
            <FormFullWidth>
              <Textarea
                label="Note"
                rows={3}
                placeholder="Optional note..."
                error={errors.note?.message}
                {...register('note')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
