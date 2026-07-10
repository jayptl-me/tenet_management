'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { FormGrid } from '@/components/ui/FormSection';
import { floorLabel } from '@/lib/resource-select-presets';
import type { IAppConfig } from '@pg/types';

const schema = z.object({
  floorId: z.string().min(1, 'Floor is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  status: z.enum(['operational', 'degraded', 'down']),
  note: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
];

export default function NewServicePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [typeOptions, setTypeOptions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((res) => {
        const defs = (res.data.amenityDefinitions ?? []).filter((d) => d.isPerFloor !== false);
        // Prefer per-floor amenities; if none flagged, use all definitions
        const floorDefs = (res.data.amenityDefinitions ?? []).filter((d) => d.isPerFloor) ?? [];
        const source = floorDefs.length > 0 ? floorDefs : defs;
        setTypeOptions(
          source.map((d) => ({
            value: d.key,
            label: d.label || d.key.replace(/_/g, ' '),
          })),
        );
      })
      .catch(() => {
        setTypeOptions([
          { value: 'wifi', label: 'WiFi' },
          { value: 'electricity', label: 'Electricity' },
          { value: 'water_supply', label: 'Water Supply' },
          { value: 'washing_machine', label: 'Washing Machine' },
        ]);
      });
  }, []);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'operational', note: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('services', { json: data }).json<{ success: boolean }>();
      router.push('/services');
    } catch {
      setSubmitError(
        'Failed to create service. Type must match an amenity definition and floor must be unique per type.',
      );
    }
  };

  return (
    <FormPage
      title="New Service"
      description="Floor-level service status from AppConfig amenity definitions"
      backHref="/services"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/services"
            submitLabel="Save Service"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
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
                  labelKey={floorLabel}
                />
              )}
            />
            <Select
              label="Service Type"
              options={
                typeOptions.length > 0 ? typeOptions : [{ value: '', label: 'Loading types...' }]
              }
              error={errors.serviceType?.message}
              {...register('serviceType')}
            />
          </FormGrid>
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            error={errors.status?.message}
            {...register('status')}
          />
          <Textarea label="Note" rows={3} placeholder="Optional note..." {...register('note')} />
        </div>
      </FormCard>
    </FormPage>
  );
}
