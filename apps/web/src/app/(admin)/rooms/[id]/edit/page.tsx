'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Hash, Banknote, Link as LinkIcon, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { findInvalidPhotoLine, parsePhotoUrls } from '@/lib/photo-urls';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
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

interface RoomData {
  roomNumber: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  floorId?: string;
  sharingType: number;
  monthlyRent: number;
  isActive: boolean;
  description?: string;
  photos?: string[];
  roomAmenities?: Array<{ amenityKey: string; status: string }>;
  beds?: Array<{ bedId: string; isOccupied: boolean; tenantId?: string }>;
  occupancyCount?: number;
}

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [roomAmenityDefs, setRoomAmenityDefs] = useState<RoomAmenityDef[]>([]);
  const [currentOccupancy, setCurrentOccupancy] = useState(0);

  type FormValues = {
    roomNumber: string;
    floorId: string;
    sharingType: number;
    monthlyRent: number;
    isActive: boolean;
    description?: string;
    photoUrls?: string;
    [key: string]: string | number | boolean | undefined;
  };

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
    photoUrls: z.string().max(2000, 'Photo URLs text cannot exceed 2000 characters').optional(),
    ...Object.fromEntries(
      roomAmenityDefs.map((a) => [
        `amenity_${a.key}`,
        z.enum(['operational', 'degraded', 'down']).optional().default('operational'),
      ]),
    ),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchedSharing = Number(watch('sharingType'));
  const isDownsizeBlocked = currentOccupancy > 0 && watchedSharing < currentOccupancy;

  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [photoError, setPhotoError] = useState('');

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
    if (!roomId) return;

    Promise.all([
      api.get(`rooms/${roomId}`).json<{ success: boolean; data: RoomData }>(),
      api.get('app-config').json<{ success: boolean; data: IAppConfig }>(),
    ])
      .then(([roomRes, configRes]) => {
        const defs = (configRes.data.amenityDefinitions ?? [])
          .filter((d) => !d.isPerFloor)
          .map((d) => ({ key: d.key, label: d.label, icon: d.icon, category: d.category }));
        setRoomAmenityDefs(defs);

        const d = roomRes.data;
        const occ = d.beds?.filter((b) => b.isOccupied).length ?? d.occupancyCount ?? 0;
        setCurrentOccupancy(occ);

        setPhotos(d.photos ?? []);

        const existingAmenities = d.roomAmenities ?? [];

        const defaults: Record<string, string | number | boolean> = {
          roomNumber: d.roomNumber,
          floorId: d.floor?._id ?? d.floorId ?? '',
          sharingType: d.sharingType ?? 2,
          monthlyRent: d.monthlyRent ?? 0,
          isActive: d.isActive ?? true,
          description: d.description ?? '',
          photoUrls: (d.photos ?? []).join('\n'),
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
    if (isDownsizeBlocked) {
      setSubmitError(
        `Cannot downsize room to ${watchedSharing} sharing: ${currentOccupancy} bed(s) are currently occupied. Check out or transfer tenants first.`,
      );
      return;
    }
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
        .put(`rooms/${roomId}`, {
          json: {
            roomNumber: data.roomNumber,
            floorId: data.floorId,
            sharingType: Number(data.sharingType),
            monthlyRent: Number(data.monthlyRent),
            isActive: data.isActive,
            description:
              typeof data.description === 'string' && data.description.trim() !== ''
                ? data.description
                : undefined,
            photos,
            roomAmenities,
          },
        })
        .json<{ success: boolean }>();

      router.push(`/rooms/${roomId}`);
    } catch (err) {
      const parsed = await parseApiError(err);
      setSubmitError(parsed.message || 'Failed to update room');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Room"
      description="Update identity, rent, and amenity health for this room"
      backHref={`/rooms/${roomId}`}
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            disabled={isDownsizeBlocked}
            cancelHref={`/rooms/${roomId}`}
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
              aria-label="Room number"
              leftIcon={<Hash className="h-4 w-4" />}
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
            <div className="space-y-1">
              <Select
                label="Sharing type"
                aria-label="Sharing type"
                options={SHARING_OPTIONS}
                error={err.sharingType?.message}
                helperText={`Currently ${currentOccupancy} bed${currentOccupancy === 1 ? '' : 's'} occupied.`}
                {...register('sharingType')}
              />
              {isDownsizeBlocked && (
                <div className="mt-2 flex items-start gap-2 rounded-(--radius-md) border border-(--color-warning-300) bg-(--color-warning-50) p-2.5 text-xs text-(--color-warning-800)">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--color-warning-600)" />
                  <div>
                    <span className="font-bold">Downsize Conflict:</span> Room currently has{' '}
                    {currentOccupancy} active occupant{currentOccupancy === 1 ? '' : 's'}. You
                    cannot reduce sharing capacity to {watchedSharing} until active tenants are
                    checked out or transferred.
                  </div>
                </div>
              )}
            </div>
            <Input
              label="Monthly rent (₹)"
              aria-label="Monthly rent in Rupees"
              type="number"
              inputMode="decimal"
              leftIcon={<Banknote className="h-4 w-4" />}
              error={err.monthlyRent?.message}
              {...register('monthlyRent')}
            />
          </FormGrid>
          <div className="mt-4 space-y-4">
            <Textarea label="Description" rows={2} {...register('description')} />
            <div>
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
