'use client';

import { useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { TriangleAlert, WashingMachine, Wrench } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormActions } from '@/components/ui/FormActions';
import { FormCard } from '@/components/ui/FormCard';
import { FormGrid } from '@/components/ui/FormSection';
import { FormPage } from '@/components/ui/FormPage';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { floorLabel } from '@/lib/resource-select-presets';
import type { AmenityDefinition } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /app-config       apps/api/src/models/appConfig.ts
//   GET /floors           apps/api/src/routes/floors.ts:88-91
//   POST /services        apps/api/src/routes/services.ts:279-358
//   POST /services        the duplicate refusal, apps/api/src/routes/services.ts:351-354

const schema = z.object({
  floorId: z.string().optional(),
  serviceType: z.string().min(1, 'Service type is required'),
  status: z.enum(['operational', 'degraded', 'down']),
  note: z.string().max(500, 'Note cannot exceed 500 characters').optional(),
});

type FormData = z.infer<typeof schema>;

// The services list, the board and a single service record live under the
// same `['services']` prefix, so one invalidation re-reads every service view.
const SERVICES_PREFIX = ['services'] as const;

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational - it works' },
  { value: 'degraded', label: 'Degraded - it works badly' },
  { value: 'down', label: 'Down - it does not work' },
];

const DEFAULT_SERVICE_TYPES = [
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water_supply', label: 'Water Supply' },
  { value: 'geyser', label: 'Geyser' },
];

/** One row of the server's answer to a bulk provisioning run. */
interface ProvisionedRow {
  floor: string;
  outcome: string;
  kind: 'created' | 'exists' | 'refused';
}

function NewServiceForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');
  const [applyToAllFloors, setApplyToAllFloors] = useState(false);

  // The board sends the office here with the floor and the service it wants
  // provisioned, so the form opens on them.
  const presetFloorId = searchParams.get('floorId') ?? '';
  const presetServiceType = searchParams.get('serviceType') ?? '';

  // The catalog of the services a floor carries. Only the per floor
  // definitions are floor services; a room only amenity is refused by the
  // server (apps/api/src/routes/services.ts:34-39).
  const { data: appConfig } = useApiQuery<{ amenityDefinitions?: AmenityDefinition[] }>(
    ['app-config'],
    'app-config',
  );

  const typeOptions = useMemo(() => {
    const defs = (appConfig?.amenityDefinitions ?? []).filter((def) => def.isPerFloor === true);
    const options = defs.map((def) => ({
      value: def.key,
      label: def.label || def.key.replace(/_/g, ' '),
    }));
    if (options.length === 0) return DEFAULT_SERVICE_TYPES;
    // The service the board asked for stays visible even when the catalog
    // does not hold it: the server answers on the write, not on the option.
    if (presetServiceType && !options.some((option) => option.value === presetServiceType)) {
      options.unshift({ value: presetServiceType, label: presetServiceType.replace(/_/g, ' ') });
    }
    return options;
  }, [appConfig, presetServiceType]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      floorId: presetFloorId,
      serviceType: presetServiceType,
      status: 'operational',
      note: '',
    },
  });

  /**
   * Provision the service.
   *
   * One floor is one write. Every floor is one write per floor, and the
   * server answers for each floor on its own: a floor that already has the
   * service is held, a floor the server refuses is failed, and the answer of
   * every floor travels to the board in the address bar.
   */
  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const floorId = (data.floorId ?? '').trim();
    if (!applyToAllFloors && floorId === '') {
      setSubmitError('Pick a floor, or apply the service to every floor.');
      return;
    }

    try {
      if (applyToAllFloors) {
        const resFloors = await api.get('floors').json<{
          success: boolean;
          data: Array<{ _id: string; label?: string }>;
        }>();
        const allFloors = resFloors.data ?? [];
        if (allFloors.length === 0) {
          setSubmitError('The server holds no floor, so there is nothing to provision.');
          return;
        }

        // The per-item outcome: every floor gets its own row, built from what
        // the server answered for that floor.
        const rows: ProvisionedRow[] = [];
        for (const floor of allFloors) {
          const floorName = floor.label ?? floor._id;
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
            rows.push({
              floor: floorName,
              outcome: 'created by the server',
              kind: 'created',
            });
          } catch (err) {
            const parsed = await parseApiError(err);
            const alreadyExists =
              parsed.code === 'CONFLICT' ||
              parsed.message.toLowerCase().includes('already exists');
            rows.push({
              floor: floorName,
              outcome: alreadyExists
                ? 'the server refused it: this floor already has this service'
                : `refused by the server: ${parsed.message}`,
              kind: alreadyExists ? 'exists' : 'refused',
            });
          }
        }

        // Invalidate before the navigation, and carry the server's per-floor
        // answer to the board so it can show it.
        await queryClient.invalidateQueries({ queryKey: SERVICES_PREFIX });
        router.push(`/services?provisioned=${encodeURIComponent(JSON.stringify(rows))}`);
      } else {
        await api
          .post('services', {
            json: {
              floorId,
              serviceType: data.serviceType,
              status: data.status,
              note: data.note ?? '',
            },
          })
          .json();
        // Invalidate before the navigation: the destination must show the
        // server's state, and a navigation unmounts this page.
        await queryClient.invalidateQueries({ queryKey: SERVICES_PREFIX });
        router.push(`/services?floorId=${encodeURIComponent(floorId)}`);
      }
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title="Provision a service"
      description="A service belongs to a floor: the server keeps one state per floor and service type"
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
            submitLabel={applyToAllFloors ? 'Provision every floor' : 'Provision the service'}
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <Checkbox
            label="Apply to every floor"
            description="The server is asked once per floor, and it answers for each floor on its own"
            checked={applyToAllFloors}
            onChange={(event) => setApplyToAllFloors(event.target.checked)}
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
              Add Washing Machine Unit
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
                    value={field.value ?? ''}
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
                  label="Service type"
                  options={typeOptions}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={errors.serviceType?.message}
                  helperText="Only the services the office tracks per floor are accepted"
                />
              )}
            />
          </FormGrid>

          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                label="State"
                options={STATUS_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.status?.message}
                helperText="The state the floor is told about. It only reaches the residents when it changes later."
              />
            )}
          />

          <Textarea
            label="Note"
            rows={3}
            placeholder="Optional note..."
            helperText="The note goes into the audit entry. It does not reach the residents of the floor."
            {...register('note')}
          />

          {/* What the save commits and what it refuses. */}
          <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-4">
            <p className="text-xs font-bold text-(--color-text-primary)">What this save does</p>
            <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-text-secondary)">
              <li>
                <strong className="text-(--color-text-primary)">It writes</strong> one service row
                for the floor and the service type: the state you picked, the note you wrote, your
                name and the time. The server writes a create entry in the audit log.
              </li>
              <li>
                <strong className="text-(--color-text-primary)">It refuses</strong> a floor that
                does not exist, a service type that the office does not track per floor, and a floor
                that already has this service: the server keeps one row per floor and service type
                and answers the second attempt with a conflict.
              </li>
              <li>
                <strong className="text-(--color-text-primary)">It tells nobody.</strong> A row
                that is created sends no message to the residents of the floor. A state change later
                does, and the board says so when it happens.
              </li>
              <li>
                <strong className="text-(--color-text-primary)">Every floor</strong> is one write
                per floor. The answer of each floor is reported on its own: created, held because
                the floor already has the service, or failed with the reason the server gave.
              </li>
            </ul>
            <p className="text-2xs mt-3 flex items-start gap-1.5 font-medium text-(--color-text-muted)">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
              A state of degraded or down written here does not reach the residents of the floor: the
              server sends no message when a row is created. Set the state from the board afterwards
              and the server pushes the update to the residents of that floor.
            </p>
          </div>

          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The floor of a service cannot be changed after the row is created: the server keeps the
            row on its floor. Remove the row and provision it again on the other floor, and the
            residents of the floor lose the service in the meantime.
          </p>
        </div>
      </FormCard>
    </FormPage>
  );
}

export default function NewServicePage() {
  return (
    <Suspense
      fallback={
        <FormPage
          title="Provision a service"
          description="A service belongs to a floor: the server keeps one state per floor and service type"
          backHref="/services"
          isLoading
          maxWidth="form"
        >
          {null}
        </FormPage>
      }
    >
      <NewServiceForm />
    </Suspense>
  );
}
