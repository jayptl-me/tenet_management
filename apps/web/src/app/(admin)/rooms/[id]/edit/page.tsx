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
import { Select } from '@/components/ui/Select';
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
  }, [roomId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type FormValues = Record<string, any>;

  const schema = z.object({
    roomNumber: z.string().min(1, 'Room number is required'),
    floorId: z.string().min(1, 'Floor is required'),
    sharingType: z.coerce.number().refine((v) => [2, 3, 4].includes(v), 'Must be 2, 3, or 4'),
    monthlyRent: z.coerce.number().min(1, 'Monthly rent is required'),
    isActive: z.boolean(),
    description: z.string().optional(),
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

  const onSubmit = async (data: FormValues) => {
    setSubmitError('');
    try {
      const roomAmenities = roomAmenityDefs.map((a) => ({
        amenityKey: a.key,
        status: data[`amenity_${a.key}`] ?? 'operational',
      }));

      await api.put(`rooms/${roomId}`, {
        json: {
          roomNumber: data.roomNumber,
          floorId: data.floorId,
          sharingType: Number(data.sharingType),
          monthlyRent: Number(data.monthlyRent),
          isActive: data.isActive,
          description: data.description || undefined,
          roomAmenities,
        },
      }).json<{ success: boolean }>();

      router.push('/rooms');
    } catch {
      setSubmitError('Failed to update room');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const err = errors as Record<string, { message?: string }>;
  const floorOptions = floors.map((f) => ({
    value: f._id,
    label: `${f.label} (Floor ${f.floorNumber})`,
  }));

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Edit Room</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Update room details</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Room Number"
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
            <label className="text-surface-800 font-display text-sm font-semibold">Description</label>
            <textarea
              rows={2}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)]"
              placeholder="Optional description..."
              {...register('description')}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('isActive')}
              className="text-brand-500 h-5 w-5 rounded border-[length:var(--bw-default)]"
            />
            <span className="text-surface-700 text-sm font-semibold">Active</span>
          </label>

          {/* Room-level amenity status */}
          {roomAmenityDefs.length > 0 && (
            <div>
              <h4 className="font-display text-surface-900 mb-3 text-sm font-bold">Room Amenity Status</h4>
              <p className="text-surface-500 mb-3 text-xs">Update the status of room-specific amenities</p>
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
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
