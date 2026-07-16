'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import type { IAppConfig } from '@pg/types';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

// We'll build the schema dynamically based on AppConfig amenity definitions
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
    label: z.string().min(1, 'Floor label is required').max(50, 'Label cannot exceed 50 characters'),
    floorNumber: z.coerce.number().int().min(0, 'Must be >= 0'),
    totalRooms: z.coerce
      .number()
      .int()
      .min(1, 'Must have at least 1 room')
      .max(50, 'Max 50 rooms'),
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
    api
      .get('app-config')
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
        <FormSection title="Floor details" description="Label, floor number, and room capacity">
          <FormGrid>
            <Input
              label="Floor label"
              placeholder="e.g. Ground Floor, First Floor"
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
