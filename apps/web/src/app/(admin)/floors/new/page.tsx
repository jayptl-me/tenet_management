'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  LayoutGrid,
  Layers,
  Shirt,
  Refrigerator,
  Home,
  AlertTriangle,
  Sparkles,
  DoorOpen,
  Hash,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
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

// ── Types ──────────────────────────────────────────────

type PerFloorAmenity = { key: string; label: string; maxPerFloor?: number; icon?: string };

interface ExistingFloor {
  id: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
}

const FALLBACK_ICON_MAP: Record<string, React.ReactNode> = {
  washing_machine: <Shirt className="h-4 w-4" />,
  fridge: <Refrigerator className="h-4 w-4" />,
  washing_machines: <Shirt className="h-4 w-4" />,
  fridges: <Refrigerator className="h-4 w-4" />,
};

function amenityIcon(key: string): React.ReactNode {
  return FALLBACK_ICON_MAP[key] ?? <LayoutGrid className="h-4 w-4" />;
}

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

function buildSchema(perFloorAmenities: PerFloorAmenity[]) {
  const amenityFields: Record<string, z.ZodNumber> = {};
  for (const a of perFloorAmenities) {
    amenityFields[a.key] = z.coerce
      .number()
      .int()
      .min(0, 'Must be >= 0')
      .max(a.maxPerFloor ?? 10, `Max ${a.maxPerFloor ?? 10}`);
  }
  return z.object({
    label: z
      .string()
      .min(1, 'Floor label is required')
      .max(50, 'Label cannot exceed 50 characters'),
    floorNumber: z.coerce.number().int().min(0, 'Must be >= 0'),
    totalRooms: z.coerce.number().int().min(1, 'Must have at least 1 room').max(50, 'Max 50 rooms'),
    ...amenityFields,
  });
}

export default function NewFloorPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [perFloorAmenities, setPerFloorAmenities] = useState<PerFloorAmenity[]>([]);
  const [existingFloors, setExistingFloors] = useState<ExistingFloor[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);

  useEffect(() => {
    Promise.all([
      api
        .get('app-config')
        .json<{ success: boolean; data: IAppConfig }>()
        .catch(() => null),
      api
        .get('floors')
        .json<{ success: boolean; data: Array<ExistingFloor & { _id?: string }> }>()
        .catch(() => null),
    ]).then(([configRes, floorsRes]) => {
      const defs = (configRes?.data.amenityDefinitions ?? [])
        .filter((d) => d.isPerFloor)
        .map((d) => ({ key: d.key, label: d.label, maxPerFloor: d.maxPerFloor, icon: d.icon }));
      setPerFloorAmenities(
        defs.length > 0
          ? defs
          : [
              { key: 'washing_machine', label: 'Washing Machines', maxPerFloor: 3 },
              { key: 'fridge', label: 'Fridges', maxPerFloor: 2 },
            ],
      );

      const raw = floorsRes?.data ?? [];
      const parsedFloors = raw.map((f) => ({
        id: String(f.id ?? f._id ?? ''),
        floorNumber: f.floorNumber,
        label: f.label,
        totalRooms: f.totalRooms,
      }));
      setExistingFloors(parsedFloors);
      setLoadingDefs(false);
    });
  }, []);

  const nextAvailableFloorNumber = useMemo(() => {
    if (existingFloors.length === 0) return 0;
    const taken = new Set(existingFloors.map((f) => f.floorNumber));
    let candidate = 0;
    while (taken.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }, [existingFloors]);

  const defaultValues = () => {
    const defaults: Record<string, number | string> = {
      label: '',
      floorNumber: nextAvailableFloorNumber,
      totalRooms: 4,
    };
    for (const a of perFloorAmenities) {
      defaults[a.key] = 0;
    }
    return defaults;
  };

  const schema = buildSchema(perFloorAmenities);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  });

  // Rebuild defaults once async amenity definitions and existing floors arrive
  useEffect(() => {
    if (!loadingDefs) {
      reset(defaultValues());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDefs, nextAvailableFloorNumber]);

  // Live preview state & collision detection
  const watchedLabel = (watch('label') as string) ?? '';
  const watchedFloorNumber = Number(watch('floorNumber')) || 0;
  const watchedTotalRooms = Number(watch('totalRooms')) || 0;

  const collidingFloor = useMemo(() => {
    return existingFloors.find((f) => f.floorNumber === watchedFloorNumber);
  }, [existingFloors, watchedFloorNumber]);

  const previewFloors = useMemo(
    () =>
      existingFloors.map((f) => ({
        id: f.id,
        floorNumber: f.floorNumber,
        label: f.label,
        totalRooms: f.totalRooms,
      })),
    [existingFloors],
  );

  const onSubmit = async (data: Record<string, unknown>) => {
    if (collidingFloor) {
      setSubmitError(
        `Floor number ${watchedFloorNumber} is already occupied by "${collidingFloor.label}". Choose an unused number.`,
      );
      return;
    }

    setSubmitError('');
    try {
      const amenityCounts = perFloorAmenities.map((a) => ({
        amenityKey: a.key,
        count: Number(data[a.key]) || 0,
      }));

      const payload = {
        label: data.label,
        floorNumber: Number(data.floorNumber),
        totalRooms: Number(data.totalRooms),
        amenityCounts,
      };

      await api.post('floors', { json: payload }).json<{ success: boolean }>();
      router.push('/floors');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title="New Floor"
      description="Add a new physical level to the building"
      backHref="/floors"
      error={submitError}
      isLoading={loadingDefs}
      maxWidth="5xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/floors"
            submitLabel="Save Floor"
            disabled={Boolean(collidingFloor)}
            divided={false}
          />
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left Column: Form Controls */}
          <div className="space-y-6">
            <FormSection
              title="Floor details"
              icon={<Building2 />}
              description="Designation, level number, and initial room capacity"
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
                            !existingFloors.some((f) => f.floorNumber === preset.defaultNumber)
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
                    helperText="Level 0 is ground floor. Basements use negative numbers."
                    error={(errors as Record<string, { message?: string }>).floorNumber?.message}
                    {...register('floorNumber')}
                  />
                  {collidingFloor && (
                    <p className="text-2xs flex items-center gap-1.5 rounded-(--radius-md) border border-(--badge-danger-border) bg-(--badge-danger-bg) px-2.5 py-1.5 font-semibold text-(--badge-danger-text)">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Floor number {watchedFloorNumber} is already occupied by &quot;
                      {collidingFloor.label}&quot;.
                    </p>
                  )}
                </div>
                <Input
                  label="Initial Room Capacity"
                  type="number"
                  placeholder="e.g. 10"
                  leftIcon={<DoorOpen className="h-4 w-4" />}
                  helperText="Placeholder room slots to pre-allocate (1 - 50)."
                  error={(errors as Record<string, { message?: string }>).totalRooms?.message}
                  {...register('totalRooms')}
                />
                <div className="flex items-center gap-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) px-3.5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--color-brand-100) text-(--color-brand-700)">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="text-2xs leading-snug text-(--color-text-secondary)">
                    <span className="font-semibold text-(--color-text-primary)">
                      Dynamic Scaling:
                    </span>{' '}
                    Individual rooms, beds, sharing types, and rates can be customized or added
                    anytime after creation.
                  </div>
                </div>
              </FormGrid>
            </FormSection>

            {perFloorAmenities.length > 0 && (
              <FormSection
                title="Per-floor amenity counts"
                icon={<Layers />}
                description="Hardware units assigned and maintained specifically for this floor"
                divided
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {perFloorAmenities.map((a) => {
                    const value = Number(watch(a.key)) || 0;
                    return (
                      <AmenityCountStepper
                        key={a.key}
                        label={a.label}
                        icon={amenityIcon(a.key)}
                        value={value}
                        min={0}
                        max={a.maxPerFloor ?? 10}
                        error={(errors as Record<string, { message?: string }>)[a.key]?.message}
                        onChange={(v) =>
                          setValue(a.key, v, { shouldValidate: true, shouldDirty: true })
                        }
                      />
                    );
                  })}
                </div>
              </FormSection>
            )}

            <FormSection
              title="What happens next"
              icon={<Home />}
              description="System initialization and operational lifecycle after creation"
              divided
            >
              <div className="text-12 space-y-2 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3.5 leading-relaxed font-medium text-(--color-text-secondary)">
                <p>
                  <strong className="text-(--color-text-primary)">Service Initialization:</strong>{' '}
                  After saving, service monitors are automatically generated for every per-floor
                  amenity definition (e.g. electrical circuits, water supply, laundry).
                </p>
                <p>
                  <strong className="text-(--color-text-primary)">Room Construction:</strong> Once
                  the floor is saved, you can add individual rooms, assign beds, and set per-bed
                  sharing pricing on the Rooms board.
                </p>
              </div>
            </FormSection>
          </div>

          {/* Right Column: Building Elevation Preview & Projected Capacity */}
          <div className="space-y-4">
            <FloorStackPreview
              floors={previewFloors}
              current={{
                floorNumber: watchedFloorNumber,
                label: watchedLabel || 'New Floor',
                totalRooms: watchedTotalRooms,
              }}
              mode="new"
            />

            {/* Projected Blueprint Snapshot */}
            <div className="space-y-3 rounded-(--radius-xl) border border-(--border-color) bg-(--color-field-bg) p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-(--color-text-primary)">
                  Floor Blueprint Snapshot
                </span>
                <StatusBadge
                  variant={collidingFloor ? 'danger' : 'info'}
                  label={collidingFloor ? 'Conflict' : 'Draft'}
                />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-(--color-text-secondary)">
                  <span className="flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5" />
                    Target Rooms:
                  </span>
                  <span className="font-semibold text-(--color-text-primary)">
                    {watchedTotalRooms} rooms
                  </span>
                </div>
                <div className="flex justify-between text-(--color-text-secondary)">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    Level Index:
                  </span>
                  <span className="font-semibold text-(--color-text-primary)">
                    Floor #{watchedFloorNumber}
                  </span>
                </div>
                <div className="flex justify-between text-(--color-text-secondary)">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Per-Floor Amenities:
                  </span>
                  <span className="font-semibold text-(--color-text-primary)">
                    {perFloorAmenities.reduce((sum, a) => sum + (Number(watch(a.key)) || 0), 0)}{' '}
                    units
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormCard>
    </FormPage>
  );
}
