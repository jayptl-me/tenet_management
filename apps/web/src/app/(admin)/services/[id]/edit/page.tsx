'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { FormActions } from '@/components/ui/FormActions';
import { FormCard } from '@/components/ui/FormCard';
import { FormGrid, FormSection } from '@/components/ui/FormSection';
import { FormPage } from '@/components/ui/FormPage';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { floorLabel } from '@/lib/resource-select-presets';
import type { AmenityDefinition } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /services/:id        apps/api/src/routes/services.ts:464-477
//   GET /app-config          apps/api/src/models/appConfig.ts
//   PUT  /services/:id       the status path, apps/api/src/routes/services.ts:361-461
//   PUT  /services/:id/full  the service type path, apps/api/src/routes/services.ts:480-569

const schema = z.object({
  serviceType: z.string().min(1, 'Service type is required'),
  status: z.enum(['operational', 'degraded', 'down']),
  note: z.string().max(500, 'Note cannot exceed 500 characters').optional(),
});

type FormData = z.infer<typeof schema>;

interface ServiceRecord {
  _id: string;
  serviceType?: string;
  status?: string;
  note?: string;
  floor?: { _id?: string; label?: string };
  floorId?: string | { _id?: string };
}

const SERVICE_KEY = (id: string) => ['services', id] as const;

// The services list, the board and a single service record live under the
// same `['services']` prefix, so one invalidation re-reads every service view.
const SERVICES_PREFIX = ['services'] as const;

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational - it works' },
  { value: 'degraded', label: 'Degraded - it works badly' },
  { value: 'down', label: 'Down - it does not work' },
];

/**
 * The floor of the service, as the server holds it.
 *
 * The record carries the floor id and the populated floor, and the two are
 * read together so the form shows the floor of the record and not a guess.
 */
function floorIdOf(service: ServiceRecord | null): string {
  const raw = service?.floorId ?? service?.floor?._id;
  if (raw && typeof raw === 'object') return String(raw._id ?? '');
  return String(raw ?? '');
}

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [submitError, setSubmitError] = useState('');

  // The record is read through the shared query stack, so the form and the
  // board never disagree about the state of the service.
  const {
    data: rawService,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<ServiceRecord>(SERVICE_KEY(id), `services/${id}`, { enabled: Boolean(id) });

  // The server answers with one service object. Anything else is not a service.
  const service = rawService && !Array.isArray(rawService) ? rawService : null;

  const { data: appConfig } = useApiQuery<{ amenityDefinitions?: AmenityDefinition[] }>(
    ['app-config'],
    'app-config',
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // The values of the form follow the record: the form is filled from the
    // server's own read, with no second copy of the state to keep in sync.
    values: {
      serviceType: service?.serviceType ?? '',
      status: (service?.status as FormData['status']) ?? 'operational',
      note: service?.note ?? '',
    },
  });

  const serviceTypeOptions = useMemo(
    () =>
      (appConfig?.amenityDefinitions ?? [])
        .filter((def) => def.isPerFloor === true)
        .map((def) => ({ value: def.key, label: def.label || def.key.replace(/_/g, ' ') })),
    [appConfig],
  );

  const floorId = floorIdOf(service);

  /**
   * Save the record.
   *
   * The state and the note go through the status path: the server stamps the
   * record with the office and the time, writes an update entry in the audit
   * log with the state it came from, and pushes a service update to the
   * active residents of the floor when the state moves.
   *
   * A service type change goes through the other path, which the server
   * refuses when the floor already has that service type and which pushes
   * nothing to the residents.
   */
  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const typeChanged =
      service?.serviceType !== undefined && service.serviceType !== data.serviceType;
    let typeWritten = false;
    try {
      if (typeChanged) {
        await api
          .put(`services/${id}/full`, {
            json: { serviceType: data.serviceType },
          })
          .json();
        typeWritten = true;
      }
      await api
        .put(`services/${id}`, {
          json: {
            status: data.status,
            note: data.note ?? '',
          },
        })
        .json();
      // Invalidate before the navigation: the destination shows the server's
      // state, and a navigation unmounts this page.
      await queryClient.invalidateQueries({ queryKey: SERVICES_PREFIX });
      router.push('/services');
    } catch (err) {
      const message = (await parseApiError(err)).message;
      setSubmitError(
        typeWritten
          ? `The service type was written, but the state and the note were not: ${message}`
          : message,
      );
    }
  };

  return (
    <FormPage
      title="Edit the service"
      description="The state of one service on one floor, and the service type it carries"
      backHref="/services"
      error={
        submitError ||
        errorMessage(queryError) ||
        (!isLoading && !service ? 'The server reports no service for this id.' : '')
      }
      isLoading={isLoading}
      maxWidth="form"
    >
      {!isLoading && !service ? null : (
        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref="/services"
              submitLabel="Save the changes"
              divided={false}
            />
          }
        >
          <FormSection title="The service" description="The floor, the service type and the state">
            <FormGrid>
              <ResourceSelect
                label="Floor"
                endpoint="floors"
                value={floorId}
                onChange={() => undefined}
                placeholder="Select floor..."
                valueKey="_id"
                labelKey={floorLabel}
                dataPath="data"
                helperText="The floor of a service cannot be changed: the server keeps the row on its floor"
                disabled
              />
              <Controller
                name="serviceType"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Service type"
                    options={serviceTypeOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.serviceType?.message}
                    helperText="The server refuses a type the floor already has"
                  />
                )}
              />
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
                    helperText="A state that moves reaches the residents of the floor"
                  />
                )}
              />
            </FormGrid>
          </FormSection>

          <FormSection title="The note" description="What the office wrote down" divided>
            <Textarea
              label="Note"
              rows={3}
              placeholder="Optional note..."
              error={errors.note?.message}
              helperText="The note goes into the audit entry and into the message the residents of the floor receive. A note on its own does not reach them."
              {...register('note')}
            />
          </FormSection>

          {/* What the save moves and who hears about it. */}
          <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-4">
            <p className="text-xs font-bold text-(--color-text-primary)">What this save does</p>
            <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-text-secondary)">
              <li>
                <strong className="text-(--color-text-primary)">The state and the note</strong> go
                through the status path of the server: it stamps the record with your name and the
                time, writes an update entry in the audit log with the state it came from, and
                pushes a service update to the active residents of the floor when the state moves.
              </li>
              <li>
                <strong className="text-(--color-text-primary)">A service type change</strong> goes
                through the other path of the server. It refuses the change when the floor already
                has that service type, and it pushes nothing to the residents: a type is a label on
                the row, not a state of the floor.
              </li>
              <li>
                <strong className="text-(--color-text-primary)">The floor does not move.</strong> The
                server keeps the row on its floor. Remove the row and provision it again on the
                other floor, and the residents of the floor lose the service in the meantime.
              </li>
            </ul>
          </div>
        </FormCard>
      )}
    </FormPage>
  );
}
