'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import type { IAppConfig } from '@pg/types';

const SHARING_OPTIONS = [
  { value: '2', label: '2 Sharing' },
  { value: '3', label: '3 Sharing' },
  { value: '4', label: '4 Sharing' },
];

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
];

type RoomAmenityDef = { key: string; label: string; icon: string; category: string };

interface FloorOption {
  _id: string;
  label: string;
  floorNumber: number;
}

interface RoomData {
  roomNumber: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  floorId?: string;
  sharingType: number;
  monthlyRent: number;
  isActive: boolean;
  description?: string;
  roomAmenities?: Array<{ amenityKey: string; status: string }>;
}

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [roomAmenityDefs, setRoomAmenityDefs] = useState<RoomAmenityDef[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type FormValues = Record<string, any>;

  const schema = z.object({
    roomNumber: z.string().min(1, 'Room number is required').max(20, 'Room number max 20 chars'),
    floorId: z.string().min(1, 'Floor is required'),
    sharingType: z.coerce.number().refine((v) => [2, 3, 4].includes(v), 'Must be 2, 3, or 4'),
    monthlyRent: z.coerce
      .number()
      .min(1000, 'Monthly rent must be at least Rs 1000')
      .max(50000, 'Monthly rent cannot exceed Rs 50000'),
    isActive: z.boolean(),
    description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
    ...Object.fromEntries(
      roomAmenityDefs.map((a) => [
        `amenity_${a.key}`,
        z.enum(['operational', 'degraded', 'down']).optional().default('operational'),
      ]),
    ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!roomId) return;

    Promise.all([
      api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomData }>(),
      api.get('floors').json<{ success: boolean; data: FloorOption[] }>(),
      api.get('app-config').json<{ success: boolean; data: IAppConfig }>(),
    ])
      .then(([roomRes, floorsRes, configRes]) => {
        setFloors(floorsRes.data);

        const defs = (configRes.data.amenityDefinitions ?? [])
          .filter((d) => !d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, icon: d.icon, category: d.category }));
        setRoomAmenityDefs(defs);

        const d = roomRes.data;
        const existingAmenities = d.roomAmenities ?? [];

        const defaults: Record<string, string | number | boolean> = {
          roomNumber: d.roomNumber,
          floorId: d.floor?._id ?? d.floorId ?? '',
          sharingType: d.sharingType ?? 2,
          monthlyRent: d.monthlyRent ?? 0,
          isActive: d.isActive ?? true,
          description: d.description ?? '',
        };

        for (const a of defs) {
          const existing = existingAmenities.find(
            (ea: { amenityKey: string; status: string }) => ea.amenityKey === a.key,
          );
          defaults[`amenity_${a.key}`] = existing?.status ?? 'operational';
        }

        reset(defaults);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load room data');
        setIsLoading(false);
      });
  }, [roomId, reset]);

  const onSubmit = async (data: FormValues) => {
    setSubmitError('');
    try {
      const roomAmenities = roomAmenityDefs.map((a) => ({
        amenityKey: a.key,
        status: data[`amenity_${a.key}`] ?? 'operational',
      }));

      await api
        .put(`rooms/${roomId}`, {
          json: {
            roomNumber: data.roomNumber,
            floorId: data.floorId,
            sharingType: Number(data.sharingType),
            monthlyRent: Number(data.monthlyRent),
            isActive: data.isActive,
            description: data.description || undefined,
            roomAmenities,
          },
        })
        .json<{ success: boolean }>();

      router.push('/rooms');
    } catch (err) {
      const parsed = await parseApiError(err);
      setSubmitError(parsed.message || 'Failed to update room');
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const floorOptions = floors.map((f) => ({
    value: f._id,
    label: `${f.label} (Floor ${f.floorNumber})`,
  }));

  return (
    <FormPage
      title="Edit Room"
      description="Update identity, rent, and amenity health for this room"
      backHref="/rooms"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/rooms"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Room details" description="Identity and commercial settings">
          <FormGrid>
            <Input
              label="Room number"
              placeholder="e.g. 101"
              error={err.roomNumber?.message}
              {...register('roomNumber')}
            />
            <Select
              label="Floor"
              options={floorOptions}
              error={err.floorId?.message}
              {...register('floorId')}
            />
            <Select
              label="Sharing type"
              options={SHARING_OPTIONS}
              error={err.sharingType?.message}
              {...register('sharingType')}
            />
            <Input
              label="Monthly rent (₹)"
              type="number"
              inputMode="decimal"
              error={err.monthlyRent?.message}
              {...register('monthlyRent')}
            />
          </FormGrid>
          <div className="mt-4 space-y-4">
            <Textarea label="Description" rows={2} {...register('description')} />
            <Checkbox
              label="Active"
              description="Inactive rooms are hidden from new tenant assignment"
              {...register('isActive')}
            />
          </div>
        </FormSection>

        {roomAmenityDefs.length > 0 && (
          <FormSection
            title="Amenity status"
            description="Operational health of room-specific amenities"
            divided
          >
            <FormGrid cols={3}>
              {roomAmenityDefs.map((a) => {
                const fieldName = `amenity_${a.key}`;
                return (
                  <Select
                    key={a.key}
                    label={a.label}
                    options={STATUS_OPTIONS}
                    error={err[fieldName]?.message}
                    {...register(fieldName)}
                  />
                );
              })}
            </FormGrid>
          </FormSection>
        )}
      </FormCard>
    </FormPage>
  );
}
