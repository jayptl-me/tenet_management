'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  DoorOpen,
  Hash,
  Layers,
  LayoutGrid,
  Refrigerator,
  Shirt,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { AmenityCountStepper } from '@/components/ui/AmenityCountStepper';
import { FloorStackPreview } from '@/components/ui/FloorStackPreview';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { clsx } from 'clsx';
import type { IAppConfig } from '@pg/types';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /floors/:id       apps/api/src/routes/floors.ts:175-183
//   GET /floors           the floors of the building
//   GET /floors/:id/rooms apps/api/src/routes/floors.ts:188-260
//   PUT /floors/:id       apps/api/src/routes/floors.ts:299-334

interface FloorRecord {
  _id: string;
  label: string;
  floorNumber: number;
  totalRooms: number;
  amenityCounts?: Array<{ amenityKey: string; count: number }>;
}

interface ExistingFloor {
  id: string;
  _id?: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
}

interface FloorRoomsStats {
  activeRooms: number;
  inactiveRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  potentialRent: number;
}

interface FloorFormValues {
  label: string;
  floorNumber: number;
  [key: string]: number | string | undefined;
}

const APP_CONFIG_KEY = ['app-config'] as const;
const FLOORS_KEY = ['floors', 'list'] as const;

const FALLBACK_ICON_MAP: Record<string, React.ReactNode> = {
  washing_machine: <Shirt className="h-4 w-4" />,
  fridge: <Refrigerator className="h-4 w-4" />,
  washing_machines: <Shirt className="h-4 w-4" />,
  fridges: <Refrigerator className="h-4 w-4" />,
};

function amenityIcon(key: string): React.ReactNode {
  return FALLBACK_ICON_MAP[key] ?? <LayoutGrid className="h-4 w-4" />;
}

/**
 * The labels the office writes a floor with.
 *
 * The level is not one of them: the server refuses a level below 0, so a
 * basement is a label on a level the building already has.
 */
const FLOOR_PRESETS = [
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
  'Basement',
  'Mezzanine',
  'Penthouse',
  'Terrace',
];

/** The schema of the form. The amenity fields are the per floor definitions. */
function buildSchema(perFloorAmenities: Array<{ key: string; maxPerFloor?: number }>) {
  const amenityFields: Record<string, z.ZodNumber> = {};
  for (const amenity of perFloorAmenities) {
    amenityFields[amenity.key] = z.coerce
      .number()
      .int()
      .min(0, 'Must be >= 0')
      .max(amenity.maxPerFloor ?? 10, `Max ${amenity.maxPerFloor ?? 10}`);
  }
  return z.object({
    label: z.string().min(1, 'Label is required').max(50, 'Label cannot exceed 50 characters'),
    floorNumber: z.coerce.number().int().min(0, 'The server refuses a level below 0'),
    ...amenityFields,
  });
}

export default function EditFloorPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [submitError, setSubmitError] = useState('');

  const {
    data: floor,
    isPending: floorPending,
    error: floorError,
  } = useApiQuery<FloorRecord>(['floors', id], `floors/${id}`, { enabled: Boolean(id) });
  const {
    data: appConfig,
    isPending: configPending,
    error: configError,
  } = useApiQuery<IAppConfig>(APP_CONFIG_KEY, 'app-config');
  const { data: floors, isPending: floorsPending } = useApiQuery<ExistingFloor[]>(
    FLOORS_KEY,
    'floors',
  );
  const { data: roomsData } = useApiQuery<{ stats: FloorRoomsStats }>(
    ['floors', id, 'rooms'],
    `floors/${id}/rooms`,
    { enabled: Boolean(id) },
  );

  // The skeleton is shown while the record is still on its way. It is derived
  // from the query, so a record that never arrives shows the error state
  // instead of a page that spins for ever.
  const isLoading = floorPending || configPending || floorsPending;

  const perFloorAmenities = useMemo(
    () =>
      (appConfig?.amenityDefinitions ?? [])
        .filter((definition) => definition.isPerFloor)
        .map((definition) => ({
          key: definition.key,
          label: definition.label,
          maxPerFloor: definition.maxPerFloor,
        })),
    [appConfig],
  );

  const existingFloors = useMemo<ExistingFloor[]>(
    () =>
      (floors ?? []).map((entry) => ({
        // The list route reads the floors lean, so the record carries the mongo
        // id and not the virtual one.
        id: String(entry.id ?? entry._id ?? ''),
        floorNumber: Number(entry.floorNumber ?? 0),
        label: String(entry.label ?? ''),
        totalRooms: Number(entry.totalRooms ?? 0),
      })),
    [floors],
  );

  const schema = buildSchema(perFloorAmenities);

  /**
   * The values the form starts from: the record the server holds.
   *
   * They are handed to the form as its reactive values, so the form is filled
   * in from the server data without a second copy of that data in a state of
   * its own.
   */
  const formValues = useMemo<FloorFormValues>(() => {
    const values: FloorFormValues = {
      label: floor?.label ?? '',
      floorNumber: Number(floor?.floorNumber ?? 0),
    };
    const counts = floor?.amenityCounts ?? [];
    for (const amenity of perFloorAmenities) {
      values[amenity.key] = counts.find((count) => count.amenityKey === amenity.key)?.count ?? 0;
    }
    return values;
  }, [floor, perFloorAmenities]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: formValues,
    values: formValues,
  });

  const watchedValues = useWatch({ control });
  const watchedLabel = String(watchedValues.label ?? '');
  const watchedFloorNumber = Number(watchedValues.floorNumber ?? 0);

  /** The other floor that already holds the level or the label of this one. */
  const collision = useMemo(() => {
    const others = existingFloors.filter((entry) => String(entry.id) !== String(id));
    const sameLevel = others.find((entry) => entry.floorNumber === watchedFloorNumber);
    // The server holds a unique index on the label and it compares the label
    // as it is written, so the check here compares it the same way.
    const sameLabel = others.find((entry) => entry.label === watchedLabel.trim());
    return { sameLevel, sameLabel };
  }, [existingFloors, id, watchedFloorNumber, watchedLabel]);

  const onSubmit = async (data: FloorFormValues) => {
    if (collision.sameLevel) {
      setSubmitError(
        `Level ${watchedFloorNumber} already belongs to "${collision.sameLevel.label}". The server ` +
          `refuses a duplicate level (DUPLICATE_FLOOR), so pick another level.`,
      );
      return;
    }
    if (collision.sameLabel) {
      setSubmitError(
        `"${collision.sameLabel.label}" is already the label of another floor. The server refuses ` +
          `a duplicate label (DUPLICATE_FLOOR), so pick another label.`,
      );
      return;
    }

    setSubmitError('');
    try {
      const amenityCounts = perFloorAmenities.map((amenity) => ({
        amenityKey: amenity.key,
        count: Number(data[amenity.key]) || 0,
      }));

      // The server strips the room count from the body: the count is kept in
      // step with the active rooms of the floor by the room hooks.
      await api
        .put(`floors/${id}`, {
          json: {
            label: String(data.label),
            floorNumber: Number(data.floorNumber),
            amenityCounts,
          },
        })
        .json();

      // The floor is re-read from the server, so the page the operator lands
      // on shows the state the server committed and not a local claim.
      await queryClient.invalidateQueries({ queryKey: ['floors'] });
      router.push(`/floors/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const stats = roomsData?.stats ?? null;

  return (
    <FormPage
      title={floor ? `Edit ${floor.label}` : 'Edit floor'}
      description={
        floor
          ? `Level ${floor.floorNumber} · the label, the level and the amenity counts of this floor`
          : 'The label, the level and the amenity counts of this floor'
      }
      backHref={`/floors/${id}`}
      error={submitError || errorMessage(floorError) || errorMessage(configError)}
      isLoading={isLoading}
      maxWidth="form"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/rooms/new?floorId=${id}`)}
          >
            <DoorOpen className="h-4 w-4" />
            Add Room
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/services?floorId=${id}`)}
          >
            <Wrench className="h-4 w-4" />
            Services
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_var(--content-rail-width)]">
        {/* The form */}
        <div className="space-y-6">
          <FormCard
            onSubmit={handleSubmit(onSubmit)}
            footer={
              <FormActions
                loading={isSubmitting}
                cancelHref={`/floors/${id}`}
                submitLabel="Save Changes"
                disabled={Boolean(collision.sameLevel || collision.sameLabel)}
                divided={false}
              />
            }
          >
            <FormSection
              title="Floor details"
              icon={<Building2 />}
              description="The label the office writes the floor with and the level of the building"
            >
              {/* Quick Label Presets */}
              <div className="space-y-1.5 pb-1">
                <span className="text-2xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
                  Quick Label Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {FLOOR_PRESETS.map((preset) => {
                    const isActive = watchedLabel === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setValue('label', preset, { shouldValidate: true, shouldDirty: true })
                        }
                        className={clsx(
                          'text-2xs rounded-full border px-2.5 py-1 font-semibold transition-all duration-150',
                          isActive
                            ? 'border-(--badge-info-border) bg-(--badge-info-bg) text-(--badge-info-text) shadow-(--shadow-xs)'
                            : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) hover:border-(--border-color-hover) hover:text-(--color-text-primary)',
                        )}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              <FormGrid cols={2}>
                <Input
                  label="Floor Label"
                  placeholder="e.g. First Floor"
                  leftIcon={<Building2 className="h-4 w-4" />}
                  error={(errors as Record<string, { message?: string }>).label?.message}
                  {...register('label')}
                />
                <div className="space-y-1">
                  <Input
                    label="Floor Level"
                    type="number"
                    placeholder="e.g. 1"
                    leftIcon={<Hash className="h-4 w-4" />}
                    helperText="The server refuses a level below 0 and a level or a label that another floor already holds."
                    error={(errors as Record<string, { message?: string }>).floorNumber?.message}
                    {...register('floorNumber')}
                  />
                  {collision.sameLevel && (
                    <p className="text-2xs flex items-center gap-1.5 rounded-(--radius-md) border border-(--badge-danger-border) bg-(--badge-danger-bg) px-2.5 py-1.5 font-semibold text-(--badge-danger-text)">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      Level {watchedFloorNumber} already belongs to &quot;
                      {collision.sameLevel.label}&quot;.
                    </p>
                  )}
                  {collision.sameLabel && (
                    <p className="text-2xs flex items-center gap-1.5 rounded-(--radius-md) border border-(--badge-danger-border) bg-(--badge-danger-bg) px-2.5 py-1.5 font-semibold text-(--badge-danger-text)">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      &quot;{collision.sameLabel.label}&quot; is already the label of another floor.
                    </p>
                  )}
                </div>
              </FormGrid>

              {/* The room count is not the office's to set here. */}
              <div className="mt-4 flex items-start gap-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--color-brand-100) text-(--color-brand-700)">
                  <DoorOpen className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-(--color-text-primary)">
                      {floor?.totalRooms ?? 0} room{(floor?.totalRooms ?? 0) === 1 ? '' : 's'} in
                      service
                      {stats ? ` · ${stats.totalBeds} bed(s)` : ''}
                    </span>
                    <StatusBadge variant="info" label="Kept by the server" />
                  </div>
                  <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                    The room count is not written by this form. The server strips it from the body
                    and keeps it in step with the active rooms of the floor every time a room is
                    saved or retired.
                  </p>
                  <Link
                    href={`/rooms?floorId=${id}`}
                    className="text-2xs mt-1.5 inline-flex items-center gap-1 font-bold text-(--color-brand-600) hover:underline"
                  >
                    <ArrowRight className="h-3 w-3" />
                    Manage the rooms of this floor
                  </Link>
                </div>
              </div>
            </FormSection>

            {perFloorAmenities.length > 0 && (
              <FormSection
                title="Per-floor amenity counts"
                icon={<Layers />}
                description="The hardware units the office declares for this level"
                divided
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {perFloorAmenities.map((amenity) => {
                    const value = Number(watchedValues[amenity.key]) || 0;
                    return (
                      <AmenityCountStepper
                        key={amenity.key}
                        label={amenity.label}
                        icon={amenityIcon(amenity.key)}
                        value={value}
                        min={0}
                        max={amenity.maxPerFloor ?? 10}
                        error={
                          (errors as Record<string, { message?: string }>)[amenity.key]?.message
                        }
                        onChange={(next) =>
                          setValue(amenity.key, next, { shouldValidate: true, shouldDirty: true })
                        }
                      />
                    );
                  })}
                </div>
              </FormSection>
            )}
          </FormCard>

          {/* What the save commits, and what it refuses. */}
          <div className="rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
            <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
              What this save commits
            </h3>
            <ul className="mt-3 space-y-2.5">
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The server writes the label, the level and the amenity counts of this floor, and
                  it writes an update entry in the audit log with the fields that moved.
                </span>
              </li>
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The room count is not part of the save: the server strips it and keeps it in step
                  with the active rooms of the floor.
                </span>
              </li>
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The services of the floor are not touched. The health of a service is a service
                  record, and it lives on the service board.
                </span>
              </li>
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  Renaming a floor moves nothing: the rooms stay on it, the residents stay in their
                  beds and the leases keep their terms. Nobody is told.
                </span>
              </li>
            </ul>

            <div className="mt-4 border-t border-(--border-color) pt-3">
              <p className="tracking-label text-2xs font-bold text-(--color-text-muted) uppercase">
                What this save refuses
              </p>
              <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-text-secondary)">
                <li className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
                  <span>
                    A level that another floor holds and a label that another floor holds
                    (DUPLICATE_FLOOR), a level below 0, a label over 50 characters and an amenity
                    count above the maximum the definition allows.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
                  <span>
                    A floor with active rooms or washing machines cannot be deleted from here. The
                    deletion lives on the floors list and it names what is in the way.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* The rail: where this floor stands and where it sits in the building. */}
        <div className="space-y-4">
          <FloorStackPreview
            floors={existingFloors}
            current={{
              floorNumber: watchedFloorNumber,
              label: watchedLabel || 'Unnamed floor',
              totalRooms: floor?.totalRooms ?? 0,
            }}
            currentId={id}
            mode="edit"
          />

          <div className="space-y-3 rounded-(--radius-xl) border border-(--border-color) bg-(--color-field-bg) p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-(--color-text-primary)">
                The floor as it stands
              </span>
              <StatusBadge
                variant={collision.sameLevel || collision.sameLabel ? 'danger' : 'success'}
                label={collision.sameLevel || collision.sameLabel ? 'Duplicate' : 'In the building'}
              />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-(--color-text-secondary)">
                <span>Rooms in service:</span>
                <span className="font-semibold text-(--color-text-primary)">
                  {stats ? stats.activeRooms : 'not reported'} / {floor?.totalRooms ?? 0}
                </span>
              </div>
              <div className="flex justify-between text-(--color-text-secondary)">
                <span>Beds taken:</span>
                <span className="font-semibold text-(--color-text-primary)">
                  {stats ? `${stats.occupiedBeds} / ${stats.totalBeds}` : 'not reported'}
                </span>
              </div>
              <div className="flex justify-between text-(--color-text-secondary)">
                <span>Beds free:</span>
                <span className="font-semibold text-(--color-text-primary)">
                  {stats ? stats.vacantBeds : 'not reported'}
                </span>
              </div>
              <div className="flex justify-between text-(--color-text-secondary)">
                <span>Floor rent /mo:</span>
                <span className="font-semibold text-(--color-text-primary)">
                  {stats ? `₹${stats.potentialRent.toLocaleString('en-IN')}` : 'not reported'}
                </span>
              </div>
            </div>
            <Link
              href={`/floors/${id}`}
              className="text-2xs inline-flex items-center gap-1 font-bold text-(--color-brand-600) hover:underline"
            >
              Open the floor
            </Link>
          </div>
        </div>
      </div>
    </FormPage>
  );
}
