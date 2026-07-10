'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import type { IAppConfig } from '@pg/types';

function buildSchema(perFloorAmenities: { key: string; label: string; maxPerFloor?: number }[]) {
  const amenityFields: Record<string, z.ZodNumber> = {};
  for (const a of perFloorAmenities) {
    amenityFields[a.key] = z.coerce
      .number()
      .int()
      .min(0, 'Must be >= 0')
      .max(a.maxPerFloor ?? 10, `Max ${a.maxPerFloor ?? 10}`);
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

  const schema = buildSchema(perFloorAmenities);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

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
      .catch(() => {
        setSubmitError('Failed to load floor data');
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
        <FormSection title="Floor details" description="Label, floor number, and room capacity">
          <FormGrid>
            <Input
              label="Label"
              error={(errors as Record<string, { message?: string }>).label?.message}
              {...register('label')}
            />
            <Input
              label="Floor number"
              type="number"
              error={(errors as Record<string, { message?: string }>).floorNumber?.message}
              {...register('floorNumber')}
            />
            <Input
              label="Total rooms"
              type="number"
              error={(errors as Record<string, { message?: string }>).totalRooms?.message}
              {...register('totalRooms')}
            />
          </FormGrid>
        </FormSection>

        {perFloorAmenities.length > 0 && (
          <FormSection
            title="Per-floor amenity counts"
            description="How many of each amenity are available on this floor"
            divided
          >
            <FormGrid cols={3}>
              {perFloorAmenities.map((a) => (
                <Input
                  key={a.key}
                  label={a.label}
                  type="number"
                  error={(errors as Record<string, { message?: string }>)[a.key]?.message}
                  {...register(a.key)}
                />
              ))}
            </FormGrid>
          </FormSection>
        )}
      </FormCard>
    </FormPage>
  );
}
