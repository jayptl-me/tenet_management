'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import type { IAppConfig } from '@pg/types';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { floorLabel } from '@/lib/resource-select-presets';

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

export default function NewRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillFloorId = searchParams.get('floorId') ?? '';
  const [submitError, setSubmitError] = useState('');
  const [roomAmenityDefs, setRoomAmenityDefs] = useState<RoomAmenityDef[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);

  useEffect(() => {
    api.get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((res) => {
        const defs = (res.data.amenityDefinitions ?? [])
          .filter((d) => !d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, icon: d.icon, category: d.category }));
        setRoomAmenityDefs(defs);
      })
      .catch(() => {
        setRoomAmenityDefs([
          { key: 'fan', label: 'Fan', icon: 'fan', category: 'furnishing' },
          { key: 'bed', label: 'Bed', icon: 'bed-single', category: 'furnishing' },
          { key: 'bedsheet', label: 'Bedsheet', icon: 'scroll-text', category: 'furnishing' },
          { key: 'pillow', label: 'Pillow', icon: 'moon-star', category: 'furnishing' },
        ]);
      })
      .finally(() => setLoadingDefs(false));
  }, []);

  // Build a flat schema dynamically with all amenity fields
  const schema = z.object({
    roomNumber: z.string().min(1, 'Room number is required'),
    floorId: z.string().min(1, 'Floor is required'),
    sharingType: z.coerce.number().refine((v) => [2, 3, 4].includes(v), 'Must be 2, 3, or 4'),
    monthlyRent: z.coerce.number().min(1, 'Monthly rent is required'),
    description: z.string().optional(),
    ...Object.fromEntries(
      roomAmenityDefs.map((a) => [
        `amenity_${a.key}`,
        z.enum(['operational', 'degraded', 'down']).optional().default('operational'),
      ]),
    ),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type FormValues = Record<string, any>;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      floorId: prefillFloorId,
      sharingType: 2,
      monthlyRent: 0,
      description: '',
      ...Object.fromEntries(roomAmenityDefs.map((a) => [`amenity_${a.key}`, 'operational'])),
    },
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitError('');
    try {
      const roomAmenities = roomAmenityDefs.map((a) => ({
        amenityKey: a.key,
        status: data[`amenity_${a.key}`] ?? 'operational',
      }));

      await api.post('rooms', {
        json: {
          roomNumber: data.roomNumber,
          floorId: data.floorId,
          sharingType: Number(data.sharingType),
          monthlyRent: Number(data.monthlyRent),
          description: data.description || undefined,
          roomAmenities,
        },
      }).json<{ success: boolean }>();

      router.push('/rooms');
    } catch {
      setSubmitError('Failed to create room. Please try again.');
    }
  };

  if (loadingDefs) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  const err = errors as Record<string, { message?: string }>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Room</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Add a new room to the PG</p>
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
              label="Room Number"
              placeholder="e.g. 101, G2"
              error={err.roomNumber?.message}
              {...register('roomNumber')}
            />
            <Controller
              name="floorId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Floor"
                  endpoint="floors"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select floor..."
                  labelKey={floorLabel}
                  error={err.floorId?.message}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Sharing Type"
              options={SHARING_OPTIONS}
              error={err.sharingType?.message}
              {...register('sharingType')}
            />
            <Input
              label="Monthly Rent (₹)"
              type="number"
              error={err.monthlyRent?.message}
              {...register('monthlyRent')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="description"
              className="text-surface-800 font-display text-sm font-semibold"
            >
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Optional description..."
              {...register('description')}
            />
          </div>

          {/* Room-level amenity status */}
          {roomAmenityDefs.length > 0 && (
            <div>
              <h4 className="font-display text-surface-900 mb-3 text-sm font-bold">Room Amenity Status</h4>
              <p className="text-surface-500 mb-3 text-xs">Set the initial status for room-specific amenities</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              </div>
            </div>
          )}
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Room
          </Button>
        </div>
      </form>
    </div>
  );
}
