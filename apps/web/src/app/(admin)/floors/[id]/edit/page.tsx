'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { IAppConfig } from '@pg/types';

function buildSchema(perFloorAmenities: { key: string; label: string; maxPerFloor?: number }[]) {
  const amenityFields: Record<string, z.ZodNumber> = {};
  for (const a of perFloorAmenities) {
    amenityFields[a.key] = z.coerce.number().int().min(0, 'Must be >= 0').max(a.maxPerFloor ?? 10, `Max ${a.maxPerFloor ?? 10}`);
  }
  return z.object({
    label: z.string().min(1, 'Label is required'),
    floorNumber: z.coerce.number().int().min(0, 'Floor number must be >= 0'),
    totalRooms: z.coerce.number().int().positive('Total rooms must be positive'),
    ...amenityFields,
  });
}

type PerFloorAmenity = { key: string; label: string; maxPerFloor?: number };

export default function EditFloorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [perFloorAmenities, setPerFloorAmenities] = useState<PerFloorAmenity[]>([]);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get(`floors/${id}`).json<{ success: boolean; data: Record<string, unknown> }>(),
      api.get('app-config').json<{ success: boolean; data: IAppConfig }>(),
    ])
      .then(([floorRes, configRes]) => {
        const defs = (configRes.data.amenityDefinitions ?? [])
          .filter((d) => d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, maxPerFloor: d.maxPerFloor }));
        setPerFloorAmenities(defs);

        const floor = floorRes.data;
        const defaults: Record<string, number | string> = {
          label: (floor.label as string) ?? '',
          floorNumber: (floor.floorNumber as number) ?? 0,
          totalRooms: (floor.totalRooms as number) ?? 0,
        };

        // Pre-fill amenity counts from floor data
        const amenityCounts = (floor.amenityCounts as Array<{ amenityKey: string; count: number }>) ?? [];
        for (const a of defs) {
          const existing = amenityCounts.find((ac: { amenityKey: string; count: number }) => ac.amenityKey === a.key);
          defaults[a.key] = existing?.count ?? 0;
        }

        reset(defaults);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load floor data');
        setIsLoading(false);
      });
  }, [id]);

  const schema = buildSchema(perFloorAmenities);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

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

      await api.put(`floors/${id}`, { json: payload }).json();
      router.push('/floors');
    } catch {
      setSubmitError('Failed to update floor');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Floor</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update floor details</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Label"
              error={(errors as Record<string, { message?: string }>).label?.message}
              {...register('label')}
            />
            <Input
              label="Floor Number"
              type="number"
              error={(errors as Record<string, { message?: string }>).floorNumber?.message}
              {...register('floorNumber')}
            />
          </div>
          <Input
            label="Total Rooms"
            type="number"
            error={(errors as Record<string, { message?: string }>).totalRooms?.message}
            {...register('totalRooms')}
          />

          {/* Dynamic amenity count fields */}
          {perFloorAmenities.length > 0 && (
            <div>
              <h4 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] mb-3 text-sm font-bold">Per-Floor Amenity Counts</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {perFloorAmenities.map((a) => (
                  <Input
                    key={a.key}
                    label={a.label}
                    type="number"
                    error={(errors as Record<string, { message?: string }>)[a.key]?.message}
                    {...register(a.key)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
