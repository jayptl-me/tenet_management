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
import { Button } from '@/components/ui/Button';
import { Hash, Banknote, Link as LinkIcon, Plus, X } from 'lucide-react';
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
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [photoError, setPhotoError] = useState('');

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

  const handleAddPhoto = () => {
    const trimmed = photoInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setPhotoError('Must be a valid http:// or https:// URL');
      return;
    }
    if (photos.includes(trimmed)) {
      setPhotoError('This photo URL has already been added');
      return;
    }
    if (photos.length >= 8) {
      setPhotoError('Maximum 8 photos allowed');
      return;
    }
    const updated = [...photos, trimmed];
    setPhotos(updated);
    setValue('photoUrls', updated.join('\n'), { shouldValidate: true });
    setPhotoInput('');
    setPhotoError('');
  };

  const handleRemovePhoto = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    setValue('photoUrls', updated.join('\n'), { shouldValidate: true });
  };

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
            <input type="hidden" {...register('photoUrls')} />
            <label className="mb-1.5 block text-xs font-semibold text-(--color-text-primary)">
              Room Photos {photos.length > 0 ? `(${photos.length}/8)` : ''}
            </label>
            <div className="space-y-3">
              {photos.length < 8 && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="https://images.example.com/room-photo.jpg"
                      value={photoInput}
                      onChange={(e) => {
                        setPhotoInput(e.target.value);
                        if (photoError) setPhotoError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPhoto();
                        }
                      }}
                      leftIcon={<LinkIcon className="h-4 w-4 text-(--color-text-muted)" />}
                      error={photoError || err.photoUrls?.message}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddPhoto}
                    className="shrink-0"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Photo
                  </Button>
                </div>
              )}

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      className="group relative flex flex-col items-center overflow-hidden rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) p-2"
                    >
                      <div className="relative h-24 w-full overflow-hidden rounded-sm bg-black/5">
                        <img
                          src={url}
                          alt={`Room photo ${idx + 1}`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="none" stroke="%2394a3b8" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                          title="Remove photo"
                          aria-label={`Remove photo ${idx + 1}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-2xs mt-1.5 w-full truncate text-center font-mono text-(--color-text-muted)">
                        {url.split('/').pop() || `Photo ${idx + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <NewRoomForm />
    </Suspense>
  );
}
