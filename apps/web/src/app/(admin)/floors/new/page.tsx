'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
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
//   GET /app-config   the per floor amenity definitions
//   GET /floors       the floors of the building
//   POST /floors      apps/api/src/routes/floors.ts:262-296

interface ExistingFloor {
  id: string;
  _id?: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
}

interface FloorFormValues {
  label: string;
  floorNumber: number;
  totalRooms: number;
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
const FLOOR_PRESETS: Array<{ label: string; defaultNumber?: number }> = [
  { label: 'Ground Floor', defaultNumber: 0 },
  { label: 'First Floor', defaultNumber: 1 },
  { label: 'Second Floor', defaultNumber: 2 },
  { label: 'Third Floor', defaultNumber: 3 },
  { label: 'Fourth Floor', defaultNumber: 4 },
  { label: 'Basement' },
  { label: 'Mezzanine' },
  { label: 'Penthouse' },
  { label: 'Terrace' },
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
    label: z
      .string()
      .min(1, 'Floor label is required')
      .max(50, 'Label cannot exceed 50 characters'),
    floorNumber: z.coerce.number().int().min(0, 'The server refuses a level below 0'),
    totalRooms: z.coerce.number().int().min(1, 'Must have at least 1 room').max(50, 'Max 50 rooms'),
    ...amenityFields,
  });
}

export default function NewFloorPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    data: appConfig,
    isPending: configPending,
    error: configError,
  } = useApiQuery<IAppConfig>(APP_CONFIG_KEY, 'app-config');
  const {
    data: floors,
    isPending: floorsPending,
    error: floorsError,
  } = useApiQuery<ExistingFloor[]>(FLOORS_KEY, 'floors');

  // The skeleton is shown while the record is still on its way. It is derived
  // from the query, so a query that fails shows the error and not a page that
  // spins for ever.
  const isLoading = configPending || floorsPending;

  /** The per floor amenity definitions the app config holds. */
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
      (floors ?? []).map((floor) => ({
        // The list route reads the floors lean, so the record carries the
        // mongo id and not the virtual one.
        id: String(floor.id ?? floor._id ?? ''),
        floorNumber: Number(floor.floorNumber ?? 0),
        label: String(floor.label ?? ''),
        totalRooms: Number(floor.totalRooms ?? 0),
      })),
    [floors],
  );

  /**
   * The next free level of the building.
   *
   * The form fills the level in, the server does not: it refuses a level that
   * is taken, and the office can still change the number before the save.
   */
  const nextAvailableFloorNumber = useMemo(() => {
    const taken = new Set(existingFloors.map((floor) => floor.floorNumber));
    let candidate = 0;
    while (taken.has(candidate)) candidate += 1;
    return candidate;
  }, [existingFloors]);

  const schema = buildSchema(perFloorAmenities);

  /**
   * The values the form starts from.
   *
   * They are handed to the form as its reactive values, so the form is filled
   * in from the server data without a second copy of that data in a state of
   * its own.
   */
  const formValues = useMemo<FloorFormValues>(() => {
    const values: FloorFormValues = {
      label: '',
      floorNumber: nextAvailableFloorNumber,
      totalRooms: 4,
    };
    for (const amenity of perFloorAmenities) {
      values[amenity.key] = 0;
    }
    return values;
  }, [nextAvailableFloorNumber, perFloorAmenities]);

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
  const watchedTotalRooms = Number(watchedValues.totalRooms ?? 0);

  /** The floor that already holds the level or the label of this one. */
  const collision = useMemo(() => {
    const sameLevel = existingFloors.find((floor) => floor.floorNumber === watchedFloorNumber);
    // The server holds a unique index on the label and it compares the label
    // as it is written, so the check here compares it the same way.
    const sameLabel = existingFloors.find((floor) => floor.label === watchedLabel.trim());
    return { sameLevel, sameLabel };
  }, [existingFloors, watchedFloorNumber, watchedLabel]);

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

      const res = await api
        .post('floors', {
          json: {
            label: String(data.label),
            floorNumber: Number(data.floorNumber),
            totalRooms: Number(data.totalRooms),
            amenityCounts,
          },
        })
        .json<{ success: boolean; data?: { id?: string; _id?: string } }>();

      // The server committed the floor. The page it lands on is the state the
      // server holds, not a claim about what it was asked to do.
      const newFloorId = res.data?.id ?? res.data?._id ?? '';
      router.push(newFloorId === '' ? '/floors' : `/floors/${newFloorId}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const amenityUnits = perFloorAmenities.reduce(
    (sum, amenity) => sum + (Number(watchedValues[amenity.key]) || 0),
    0,
  );

  return (
    <FormPage
      title="New Floor"
      description="Add a level to the building: the server writes the level and seeds the services of that level"
      backHref="/floors"
      error={submitError || errorMessage(configError) || errorMessage(floorsError)}
      isLoading={isLoading}
      maxWidth="full"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_var(--content-rail-width)]">
        {/* The form */}
        <div className="space-y-6">
          <FormCard
            onSubmit={handleSubmit(onSubmit)}
            footer={
              <FormActions
                loading={isSubmitting}
                cancelHref="/floors"
                submitLabel="Save Floor"
                disabled={Boolean(collision.sameLevel || collision.sameLabel)}
                divided={false}
              />
            }
          >
            <FormSection
              title="Floor details"
              icon={<Building2 />}
              description="The level of the building and the label the office writes it with"
            >
              {/* Quick Label Presets */}
              <div className="space-y-1.5 pb-1">
                <span className="text-2xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
                  Quick Label Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {FLOOR_PRESETS.map((preset) => {
                    const isActive = watchedLabel === preset.label;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setValue('label', preset.label, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          if (
                            preset.defaultNumber !== undefined &&
                            !existingFloors.some(
                              (floor) => floor.floorNumber === preset.defaultNumber,
                            )
                          ) {
                            setValue('floorNumber', preset.defaultNumber, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }
                        }}
                        className={clsx(
                          'text-2xs rounded-full border px-2.5 py-1 font-semibold transition-all duration-150',
                          isActive
                            ? 'border-(--badge-info-border) bg-(--badge-info-bg) text-(--badge-info-text) shadow-(--shadow-xs)'
                            : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) hover:border-(--border-color-hover) hover:text-(--color-text-primary)',
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <FormGrid cols={2}>
                <Input
                  label="Floor Label"
                  placeholder="e.g. Ground Floor, First Floor"
                  leftIcon={<Building2 className="h-4 w-4" />}
                  error={(errors as Record<string, { message?: string }>).label?.message}
                  {...register('label')}
                />
                <div className="space-y-1">
                  <Input
                    label="Floor Level"
                    type="number"
                    placeholder="e.g. 0"
                    leftIcon={<Hash className="h-4 w-4" />}
                    helperText="Filled in with the next free level. The server refuses a level below 0 and a level that is taken."
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
                <Input
                  label="Initial Room Capacity"
                  type="number"
                  placeholder="e.g. 10"
                  leftIcon={<DoorOpen className="h-4 w-4" />}
                  helperText="Placeholder room slots. The server recounts this from the active rooms of the floor on every room save."
                  error={(errors as Record<string, { message?: string }>).totalRooms?.message}
                  {...register('totalRooms')}
                />
              </FormGrid>
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

            {appConfig && perFloorAmenities.length === 0 && (
              <p className="text-2xs mt-4 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3 font-medium text-(--color-text-secondary)">
                The app config holds no per-floor amenity definition, so this level carries no
                amenity count and the server will seed no service row for it. The office can add the
                definitions in the settings and set the services up on the floor afterwards.
              </p>
            )}
          </FormCard>

          {/* What the save commits, and what it refuses. The office has to know
              before it commits, because a level is not a room and a count is
              not a service. */}
          <div className="rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
            <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
              What this save commits
            </h3>
            <ul className="mt-3 space-y-2.5">
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The server writes the floor with the level, the label and the room count, and it
                  writes a create entry in the audit log with the three of them.
                </span>
              </li>
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The level is filled in with the next free level of the building by this form, not
                  by the server. The server does not assign a level: it refuses one that is taken,
                  so the level can still be changed before the save.
                </span>
              </li>
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The server seeds a service status for every per-floor amenity definition it holds,
                  and each new row starts operational. If the seed fails the floor still exists and
                  the office sets the services up on the floor page afterwards.
                </span>
              </li>
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The room count is a placeholder. The server recounts it from the active rooms of
                  the floor every time a room is saved or retired, so the number on the floor card
                  becomes the number of rooms that are in service.
                </span>
              </li>
              <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                <span>
                  The amenity counts are the inventory the office declares for this level. They are
                  not the health of a service: the health is a service record and it lives on the
                  service board.
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
                    A level that is already taken and a label that is already taken
                    (DUPLICATE_FLOOR), a level below 0, a label over 50 characters and a room count
                    outside 1 to 50.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
                  <span>
                    Nothing is billed here. What a resident owes is raised from the rent on their
                    own record, and a floor carries no rent.
                  </span>
                </li>
              </ul>
              <p className="text-2xs mt-2 flex items-start gap-2 font-medium text-(--color-text-muted)">
                <DoorOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Nobody is told about a new floor. A resident is moved into a bed from the room page,
                and the server writes that move in the audit log.
              </p>
            </div>
          </div>
        </div>

        {/* The rail: the floor the office is about to commit. */}
        <div className="space-y-4">
          <FloorStackPreview
            floors={existingFloors}
            current={{
              floorNumber: watchedFloorNumber,
              label: watchedLabel || 'New Floor',
              totalRooms: watchedTotalRooms,
            }}
            mode="new"
          />

          <div className="space-y-3 rounded-(--radius-xl) border border-(--border-color) bg-(--color-field-bg) p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-(--color-text-primary)">
                The floor you are about to commit
              </span>
              <StatusBadge
                variant={collision.sameLevel || collision.sameLabel ? 'danger' : 'info'}
                label={collision.sameLevel || collision.sameLabel ? 'Duplicate' : 'Draft'}
              />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-(--color-text-secondary)">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Label:
                </span>
                <span className="font-semibold text-(--color-text-primary)">
                  {watchedLabel || 'not set yet'}
                </span>
              </div>
              <div className="flex justify-between text-(--color-text-secondary)">
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  Level:
                </span>
                <span className="font-semibold text-(--color-text-primary)">
                  {watchedFloorNumber}
                </span>
              </div>
              <div className="flex justify-between text-(--color-text-secondary)">
                <span className="flex items-center gap-1">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Room slots:
                </span>
                <span className="font-semibold text-(--color-text-primary)">
                  {watchedTotalRooms}
                </span>
              </div>
              <div className="flex justify-between text-(--color-text-secondary)">
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  Amenity units:
                </span>
                <span className="font-semibold text-(--color-text-primary)">{amenityUnits}</span>
              </div>
              <div className="flex justify-between text-(--color-text-secondary)">
                <span className="flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" />
                  Service rows seeded:
                </span>
                <span className="font-semibold text-(--color-text-primary)">
                  {perFloorAmenities.length}
                </span>
              </div>
            </div>
            <p className="text-2xs font-medium text-(--color-text-muted)">
              One service row per per-floor amenity definition the app config holds. The seed is
              best effort: if it fails, the floor exists and the services are set up by hand on the
              floor page.
            </p>
          </div>
        </div>
      </div>
    </FormPage>
  );
}
