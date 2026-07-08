'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { IAppConfig } from '@pg/types';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

// We'll build the schema dynamically based on AppConfig amenity definitions
function buildSchema(perFloorAmenities: { key: string; label: string; maxPerFloor?: number }[]) {
  const amenityFields: Record<string, z.ZodNumber> = {};
  for (const a of perFloorAmenities) {
    amenityFields[a.key] = z.coerce.number().int().min(0, 'Must be >= 0').max(a.maxPerFloor ?? 10, `Max ${a.maxPerFloor ?? 10}`);
  }
  return z.object({
    label: z.string().min(1, 'Floor label is required'),
    floorNumber: z.coerce.number().int().min(0, 'Must be >= 0'),
    totalRooms: z.coerce.number().int().min(1, 'Must have at least 1 room'),
    ...amenityFields,
  });
}

type PerFloorAmenity = { key: string; label: string; maxPerFloor?: number };

export default function NewFloorPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [perFloorAmenities, setPerFloorAmenities] = useState<PerFloorAmenity[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);

  useEffect(() => {
    api.get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((res) => {
        const defs = (res.data.amenityDefinitions ?? [])
          .filter((d) => d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, maxPerFloor: d.maxPerFloor }));
        setPerFloorAmenities(defs);
      })
      .catch(() => {
        // Fallback to hardcoded defaults if AppConfig fetch fails
        setPerFloorAmenities([
          { key: 'washing_machine', label: 'Washing Machines', maxPerFloor: 3 },
          { key: 'fridge', label: 'Fridges', maxPerFloor: 2 },
        ]);
      })
      .finally(() => setLoadingDefs(false));
  }, []);

  const defaultValues = () => {
    const defaults: Record<string, number | string> = {
      floorNumber: 1,
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
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
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

      await api.post('floors', { json: payload }).json<{ success: boolean }>();
      router.push('/floors');
    } catch {
      setSubmitError('Failed to create floor. Please try again.');
    }
  };

  if (loadingDefs) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
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
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Floor</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Add a new floor to the PG</p>
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
              label="Floor Label"
              placeholder="e.g. Ground Floor, First Floor"
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
              <h4 className="font-display text-surface-900 mb-3 text-sm font-bold">Per-Floor Amenity Counts</h4>
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
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Floor
          </Button>
        </div>
      </form>
    </div>
  );
}
