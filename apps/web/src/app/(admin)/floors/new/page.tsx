'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, LayoutGrid, Layers, Shirt, Refrigerator, Home } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import type { IAppConfig } from '@pg/types';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { AmenityCountStepper } from '@/components/ui/AmenityCountStepper';
import { FloorStackPreview } from '@/components/ui/FloorStackPreview';

// ── Types ──────────────────────────────────────────────

type PerFloorAmenity = { key: string; label: string; maxPerFloor?: number; icon?: string };

interface ExistingFloor {
  id: string;
  floorNumber: number;
  label: string;
  totalRooms: number;
}

const FALLBACK_ICON_MAP: Record<string, React.ReactNode> = {
  washing_machine: <Shirt />,
  fridge: <Refrigerator />,
  washing_machines: <Shirt />,
  fridges: <Refrigerator />,
};

function amenityIcon(key: string): React.ReactNode {
  return FALLBACK_ICON_MAP[key] ?? <LayoutGrid />;
}

// We build the schema dynamically based on AppConfig amenity definitions
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
      setExistingFloors(
        raw.map((f) => ({
          id: String(f.id ?? f._id ?? ''),
          floorNumber: f.floorNumber,
          label: f.label,
          totalRooms: f.totalRooms,
        })),
      );
      setLoadingDefs(false);
    });
  }, []);

  const defaultValues = () => {
    const defaults: Record<string, number | string> = {
      floorNumber: existingFloors.length,
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

  // Rebuild defaults once async amenity definitions arrive (schema depends on them).
  useEffect(() => {
    if (!loadingDefs) {
      reset(defaultValues());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDefs]);

  const onSubmit = async (data: Record<string, unknown>) => {
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

  // Live preview state
  const watchedLabel = (watch('label') as string) ?? '';
  const watchedFloorNumber = Number(watch('floorNumber')) || 0;
  const watchedTotalRooms = Number(watch('totalRooms')) || 0;

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

    return (
    <FormPage
      title="New Floor"
      description="Add a new floor to the PG"
      backHref="/floors"
      error={submitError}
      isLoading={loadingDefs}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/floors"
            submitLabel="Save Floor"
            divided={false}
          />
        }
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
          <FormSection
            title="Floor details"
            icon={<Building2 />}
            description="Label, floor number, and room capacity"
          >
            <FormGrid>
              <Input
                label="Floor label"
                placeholder="e.g. Ground Floor, First Floor"
                hint="Max 50 chars"
                error={(errors as Record<string, { message?: string }>).label?.message}
                {...register('label')}
              />
              <Input
                label="Floor number"
                type="number"
                hint="0 = ground"
                error={(errors as Record<string, { message?: string }>).floorNumber?.message}
                {...register('floorNumber')}
              />
              <Input
                label="Total rooms"
                type="number"
                hint="Max 50"
                error={(errors as Record<string, { message?: string }>).totalRooms?.message}
                {...register('totalRooms')}
              />
            </FormGrid>
          </FormSection>

          <FloorStackPreview
            floors={previewFloors}
            current={{
              floorNumber: watchedFloorNumber,
              label: watchedLabel,
              totalRooms: watchedTotalRooms,
            }}
            mode="new"
          />
        </div>

        {perFloorAmenities.length > 0 && (
          <FormSection
            title="Per-floor amenity counts"
            icon={<Layers />}
            description="How many of each amenity are available on this floor"
            divided
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          description="After saving, service statuses are auto-created for every per-floor amenity. Rooms and beds are added on the Rooms page."
          divided
        >
          <p className="text-[13px] font-medium leading-relaxed text-[color:var(--color-text-secondary)]">
            Room capacity on the floor auto-syncs as rooms are added, moved, or deactivated. Floor
            number and label must be unique.
          </p>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
