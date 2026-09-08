'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { findInvalidPhotoLine, parsePhotoUrls } from '@/lib/photo-urls';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Hash, Banknote } from 'lucide-react';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import type { IAppConfig } from '@pg/types';
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

function NewRoomForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillFloorId = searchParams.get('floorId') ?? '';
  const [submitError, setSubmitError] = useState('');
  const [roomAmenityDefs, setRoomAmenityDefs] = useState<RoomAmenityDef[]>([]);
  const [roomPricing, setRoomPricing] = useState<{
    sharing2: number;
    sharing3: number;
    sharing4: number;
  } | null>(null);
  const [rentTouched, setRentTouched] = useState(false);
  const [loadingDefs, setLoadingDefs] = useState(true);

  const schema = z.object({
    roomNumber: z.string().min(1, 'Room number is required').max(20, 'Room number max 20 chars'),
    floorId: z.string().min(1, 'Floor is required'),
    sharingType: z.coerce.number().refine((v) => [2, 3, 4].includes(v), 'Must be 2, 3, or 4'),
    monthlyRent: z.coerce
      .number()
      .min(1000, 'Monthly rent must be at least Rs 1000')
      .max(50000, 'Monthly rent cannot exceed Rs 50000'),
    description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
    photoUrls: z.string().max(2000, 'Photo URLs text cannot exceed 2000 characters').optional(),
    ...Object.fromEntries(
      roomAmenityDefs.map((a) => [
        `amenity_${a.key}`,
        z.enum(['operational', 'degraded', 'down']).optional().default('operational'),
      ]),
    ),
  });

  type FormValues = {
    roomNumber: string;
    floorId: string;
    sharingType: number;
    monthlyRent: number;
    description?: string;
    photoUrls?: string;
    [key: string]: string | number | undefined;
  };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      floorId: prefillFloorId,
      sharingType: 2,
      monthlyRent: 7000,
      description: '',
      photoUrls: '',
      ...Object.fromEntries(roomAmenityDefs.map((a) => [`amenity_${a.key}`, 'operational'])),
    },
  });

  const watchedSharing = Number(watch('sharingType'));

  useEffect(() => {
    api
      .get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((res) => {
        const defs = (res.data.amenityDefinitions ?? [])
          .filter((d) => !d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, icon: d.icon, category: d.category }));
        setRoomAmenityDefs(defs);
        if (res.data.roomPricing) {
          setRoomPricing(res.data.roomPricing);
          if (!rentTouched) {
            const defaultRent = res.data.roomPricing.sharing2 ?? 7000;
            setValue('monthlyRent', defaultRent);
          }
        }
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
  }, [rentTouched, setValue]);

  useEffect(() => {
    if (!rentTouched && roomPricing) {
      const key = `sharing${watchedSharing}` as keyof typeof roomPricing;
      const defaultRent = roomPricing[key];
      if (defaultRent) {
        setValue('monthlyRent', defaultRent);
      }
    }
  }, [watchedSharing, roomPricing, rentTouched, setValue]);

  const onSubmit = async (data: FormValues) => {
    setSubmitError('');
    const badLine = findInvalidPhotoLine(
      typeof data.photoUrls === 'string' ? data.photoUrls : undefined,
    );
    if (badLine > 0) {
      setSubmitError(`Photo URLs line ${badLine} is not a valid http(s) URL.`);
      return;
    }
    try {
      const roomAmenities = roomAmenityDefs.map((a) => ({
        amenityKey: a.key,
        status:
          typeof data[`amenity_${a.key}`] === 'string'
            ? (data[`amenity_${a.key}`] as string)
            : 'operational',
      }));

      const photos = parsePhotoUrls(
        typeof data.photoUrls === 'string' ? data.photoUrls : undefined,
      );

      await api
        .post('rooms', {
          json: {
            roomNumber: data.roomNumber,
            floorId: data.floorId,
            sharingType: Number(data.sharingType),
            monthlyRent: Number(data.monthlyRent),
            description:
              typeof data.description === 'string' && data.description.trim() !== ''
                ? data.description
                : undefined,
            ...(photos.length > 0 ? { photos } : {}),
            roomAmenities,
          },
        })
        .json<{ success: boolean }>();

      router.push('/rooms');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Room"
      description="Add a new room to the PG"
      backHref="/rooms"
      error={submitError}
      isLoading={loadingDefs}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/rooms"
            submitLabel="Save Room"
            divided={false}
          />
        }
      >
        <FormSection title="Room details" description="Number, floor, sharing, and rent">
          <FormGrid>
            <Input
              label="Room number"
              placeholder="e.g. 101, G2"
              error={err.roomNumber?.message}
              leftIcon={<Hash className="h-4 w-4" />}
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
            <Select
              label="Sharing type"
              aria-label="Sharing type"
              options={SHARING_OPTIONS}
              error={err.sharingType?.message}
              {...register('sharingType')}
            />
            <Input
              label="Monthly rent (₹)"
              aria-label="Monthly rent in Rupees"
              type="number"
              error={err.monthlyRent?.message}
              leftIcon={<Banknote className="h-4 w-4" />}
              {...register('monthlyRent', {
                onChange: () => setRentTouched(true),
              })}
            />
          </FormGrid>
          <div className="mt-4">
            <Textarea
              label="Description"
              rows={3}
              placeholder="Optional description..."
              {...register('description')}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Photo URLs"
              rows={3}
              placeholder="Paste image URLs (one per line, e.g. https://...)"
              helperText="Add public image links for this room. One URL per line."
              error={err.photoUrls?.message}
              {...register('photoUrls')}
            />
          </div>
        </FormSection>

        {roomAmenityDefs.length > 0 && (
          <FormSection
            title="Room amenity status"
            description="Set the initial status for room-specific amenities"
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

export default function NewRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <NewRoomForm />
    </Suspense>
  );
}
