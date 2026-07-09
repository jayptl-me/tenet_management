'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
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
        const floorDefs =
          (res.data.amenityDefinitions ?? []).filter((d) => d.isPerFloor) ?? [];
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
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
            New Service
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Floor-level service status from AppConfig amenity definitions
          </p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                typeOptions.length > 0
                  ? typeOptions
                  : [{ value: '', label: 'Loading types...' }]
              }
              error={errors.serviceType?.message}
              {...register('serviceType')}
            />
          </div>
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            error={errors.status?.message}
            {...register('status')}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="note"
              className="text-sm font-semibold text-[color:var(--color-text-primary)]"
            >
              Note
            </label>
            <textarea
              id="note"
              rows={3}
              className="w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-4 py-2.5 text-base"
              placeholder="Optional note..."
              {...register('note')}
            />
          </div>
        </div>
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" /> Save Service
          </Button>
        </div>
      </form>
    </div>
  );
}
