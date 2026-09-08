'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, LayoutGrid, Layers, Shirt, Refrigerator, Home } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { AmenityCountStepper } from '@/components/ui/AmenityCountStepper';
import { FloorStackPreview } from '@/components/ui/FloorStackPreview';
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
  washing_machine: <Shirt />,
  fridge: <Refrigerator />,
  washing_machines: <Shirt />,
  fridges: <Refrigerator />,
};

function amenityIcon(key: string): React.ReactNode {
  return FALLBACK_ICON_MAP[key] ?? <LayoutGrid />;
}

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
    label: z.string().min(1, 'Label is required').max(50, 'Label cannot exceed 50 characters'),
    floorNumber: z.coerce.number().int().min(0, 'Floor number must be >= 0'),
    ...amenityFields,
  });
}

export default function EditFloorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [perFloorAmenities, setPerFloorAmenities] = useState<PerFloorAmenity[]>([]);
  const [existingFloors, setExistingFloors] = useState<ExistingFloor[]>([]);
  // totalRooms is server-managed (Room post-save hook); display only, never PUT.
  const [totalRooms, setTotalRooms] = useState(0);

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
  });

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get(`floors/${id}`).json<{ success: boolean; data: Record<string, unknown> }>(),
      api.get('app-config').json<{ success: boolean; data: IAppConfig }>(),
      api
        .get('floors')
        .json<{ success: boolean; data: Array<ExistingFloor & { _id?: string }> }>()
        .catch(() => null),
    ])
      .then(([floorRes, configRes, floorsRes]) => {
        const defs = (configRes.data.amenityDefinitions ?? [])
          .filter((d) => d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, maxPerFloor: d.maxPerFloor, icon: d.icon }));
        setPerFloorAmenities(defs);

        const floor = floorRes.data;
        setTotalRooms((floor.totalRooms as number) ?? 0);

        const raw = floorsRes?.data ?? [];
        setExistingFloors(
          raw.map((f) => ({
            id: String(f.id ?? f._id ?? ''),
            floorNumber: f.floorNumber,
            label: f.label,
            totalRooms: f.totalRooms,
          })),
        );

        const defaults: Record<string, number | string> = {
          label: (floor.label as string) ?? '',
          floorNumber: (floor.floorNumber as number) ?? 0,
        };

        // Pre-fill amenity counts from floor data
        const amenityCounts =
          (floor.amenityCounts as Array<{ amenityKey: string; count: number }>) ?? [];
        for (const a of defs) {
          const existing = amenityCounts.find(
            (ac: { amenityKey: string; count: number }) => ac.amenityKey === a.key,
          );
          defaults[a.key] = existing?.count ?? 0;
        }

        reset(defaults);
        setIsLoading(false);
      })
      .catch(async (err) => {
        setSubmitError((await parseApiError(err)).message);
        setIsLoading(false);
      });
  }, [id, reset]);

    const onSubmit = async (data: Record<string, unknown>) => {
    setSubmitError('');
    try {
      const amenityCounts = perFloorAmenities.map((a) => ({
        amenityKey: a.key,
        count: Number(data[a.key]) || 0,
      }));

      // Do not send totalRooms -- API strips it; count is auto-synced from rooms.
      const payload = {
        label: data.label,
        floorNumber: Number(data.floorNumber),
        amenityCounts,
      };

      await api.put(`floors/${id}`, { json: payload }).json();
      router.push('/floors');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  // Live preview state
  const watchedLabel = (watch('label') as string) ?? '';
  const watchedFloorNumber = Number(watch('floorNumber')) || 0;

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
      title="Edit Floor"
      description="Update floor details"
      backHref="/floors"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/floors"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
          <FormSection
            title="Floor details"
            icon={<Building2 />}
            description="Label and floor number (room count auto-syncs from rooms)"
          >
            <FormGrid>
              <Input
                label="Label"
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
                value={totalRooms}
                readOnly
                helperText="Auto-synced from rooms on this floor"
              />
            </FormGrid>
          </FormSection>

          <FloorStackPreview
            floors={previewFloors}
            current={{
              floorNumber: watchedFloorNumber,
              label: watchedLabel,
              totalRooms,
            }}
            currentId={id}
            mode="edit"
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
          title="Good to know"
          icon={<Home />}
          description="Behavior of saved changes"
          divided
        >
          <p className="text-[13px] font-medium leading-relaxed text-[color:var(--color-text-secondary)]">
            Room count is recalculated automatically from active rooms. Changing the floor number
            must not collide with another existing floor. Service statuses for per-floor amenities
            are managed on the Services page.
          </p>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
