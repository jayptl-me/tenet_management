'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { WashingMachine } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import { floorLabel } from '@/lib/resource-select-presets';
import type { IAppConfig } from '@pg/types';

const schema = z.object({
  floorId: z.string().optional(),
  serviceType: z.string().min(1, 'Service type is required'),
  status: z.enum(['operational', 'degraded', 'down']),
  note: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

// The services list, the summary tiles and a single service record live under
// the same `['services']` prefix, so one invalidation re-reads every service view.
const SERVICES_PREFIX = ['services'] as const;

/** One row of the server's answer to a bulk provisioning run. */
interface ProvisionedRow {
  floor: string;
  outcome: string;
}

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
];

const DEFAULT_SERVICE_TYPES = [
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water_supply', label: 'Water Supply' },
  { value: 'geyser', label: 'Geyser' },
];

export default function NewServicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState('');
  const [applyToAllFloors, setApplyToAllFloors] = useState(false);
  const [typeOptions, setTypeOptions] =
    useState<Array<{ value: string; label: string }>>(DEFAULT_SERVICE_TYPES);

  useEffect(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((res) => {
        // Strict isPerFloor === true mirror of the API guard: room-only
        // amenities are rejected server-side with INVALID_SERVICE_TYPE.
        const rawDefs = res.data.amenityDefinitions ?? [];
        const floorDefs = rawDefs.filter((d) => d.isPerFloor === true);
        if (floorDefs.length > 0) {
          setTypeOptions(
            floorDefs.map((d) => ({
              value: d.key,
              label: d.label || d.key.replace(/_/g, ' '),
            })),
          );
        } else {
          setTypeOptions(DEFAULT_SERVICE_TYPES);
        }
      })
      .catch(() => {
        setTypeOptions(DEFAULT_SERVICE_TYPES);
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
    if (!applyToAllFloors && (!data.floorId || data.floorId.trim() === '')) {
      setSubmitError('Please select a floor or check "Apply to All Floors".');
      return;
    }

    try {
      if (applyToAllFloors) {
        const resFloors = await api.get('floors?limit=100').json<{
          success: boolean;
          data: Array<{ _id: string; label?: string }>;
        }>();
        const allFloors = resFloors.data ?? [];
        if (allFloors.length === 0) {
          throw new Error('No floors found in this property.');
        }
        // Per-item outcome: every floor gets its own row, built from what the
        // server answered for that floor.
        const rows: ProvisionedRow[] = [];
        for (const floor of allFloors) {
          const floorLabel = floor.label ?? floor._id;
          try {
            await api
              .post('services', {
                json: {
                  floorId: floor._id,
                  serviceType: data.serviceType,
                  status: data.status,
                  note: data.note ?? '',
                },
              })
              .json();
            rows.push({ floor: floorLabel, outcome: 'created by the server' });
          } catch (err) {
            const parsed = await parseApiError(err);
            const alreadyExists =
              parsed.message.toLowerCase().includes('already exists') ||
              Boolean(parsed.code?.includes('DUPLICATE'));
            rows.push({
              floor: floorLabel,
              outcome: alreadyExists
                ? 'already existed on the server'
                : `rejected by the server: ${parsed.message}`,
            });
          }
        }
        // Invalidate before the navigation, and carry the server's per-floor
        // answer to the list so it can show it.
        await queryClient.invalidateQueries({ queryKey: SERVICES_PREFIX });
        router.push(`/services?provisioned=${encodeURIComponent(JSON.stringify(rows))}`);
      } else {
        await api.post('services', { json: data }).json<{ success: boolean }>();
        // Invalidate before the navigation: the destination list must show the
        // server's state, and a navigation unmounts this page.
        await queryClient.invalidateQueries({ queryKey: SERVICES_PREFIX });
        router.push('/services');
      }
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title="New Service"
      description="Floor-level service status from AppConfig amenity definitions"
      backHref="/services"
      error={submitError}
      maxWidth="form"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/services"
            submitLabel={applyToAllFloors ? 'Provision All Floors' : 'Save Service'}
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <Checkbox
            label="Apply to All Floors"
            description="Provision this service across every floor in the property"
            checked={applyToAllFloors}
            onChange={(e) => setApplyToAllFloors(e.target.checked)}
          />

          <div className="flex flex-col justify-between gap-3 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) p-3 text-xs text-(--color-text-secondary) sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <WashingMachine className="h-4 w-4 shrink-0 text-(--color-brand-600)" />
              <span>
                Looking to add physical washing machines for resident laundry slot bookings?
              </span>
            </div>
            <Link
              href="/washing-machines/new"
              className="shrink-0 font-semibold text-(--color-brand-600) hover:underline"
            >
              Add Washing Machine Unit &rarr;
            </Link>
          </div>

          <FormGrid>
            {!applyToAllFloors && (
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
            )}
            <Controller
              name="serviceType"
              control={control}
              render={({ field }) => (
                <Select
                  label="Service Type"
                  options={
                    typeOptions.length > 0
                      ? typeOptions
                      : [{ value: '', label: 'Loading types...' }]
                  }
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.serviceType?.message}
                />
              )}
            />
          </FormGrid>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.status?.message}
              />
            )}
          />
          <Textarea label="Note" rows={3} placeholder="Optional note..." {...register('note')} />
        </div>
      </FormCard>
    </FormPage>
  );
}
