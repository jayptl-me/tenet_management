'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { findInvalidPhotoLine, parsePhotoUrls } from '@/lib/photo-urls';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import {
  Hash,
  Banknote,
  Link as LinkIcon,
  Plus,
  X,
  Bed,
  CheckCircle2,
  TriangleAlert,
} from 'lucide-react';
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

/** The bed letters the server creates for a sharing type. */
function bedsFor(sharingType: number): string[] {
  if (sharingType !== 2 && sharingType !== 3 && sharingType !== 4) return [];
  return ['A', 'B', 'C', 'D'].slice(0, sharingType);
}

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

  const watchedSharing = Number(useWatch({ control, name: 'sharingType' }));
  const bedLetters = bedsFor(watchedSharing);
  const bedCountText = `${bedLetters.length} bed${bedLetters.length === 1 ? '' : 's'}, all free and with no resident in them.`;

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

      const photoList = parsePhotoUrls(
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
            ...(photoList.length > 0 ? { photos: photoList } : {}),
            roomAmenities,
          },
        })
        .json<{ success: boolean; data?: { _id?: string } }>();

      router.push('/rooms');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Room"
      description="Add a room to the building: the server creates its beds from the sharing type"
      backHref="/rooms"
      error={submitError}
      isLoading={loadingDefs}
      maxWidth="form"
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

          {/* The bed count is not the office's to set: the server derives it
              from the sharing type and refuses a room whose bed count does not
              match it. So the form shows the beds the save will create. */}
          <div className="mt-4 rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) p-3">
            <p className="text-xs font-bold text-(--color-text-primary)">
              The beds this save creates
            </p>
            {bedLetters.length === 0 ? (
              <p className="text-2xs mt-2 font-medium text-(--color-text-secondary)">
                Pick a sharing type: the server builds the beds from it.
              </p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {bedLetters.map((letter) => (
                    <span
                      key={letter}
                      className="text-2xs flex h-7 w-7 items-center justify-center rounded-(--radius-sm) border border-dashed border-(--color-success-300) bg-(--color-success-50) font-mono font-bold text-(--color-success-800)"
                    >
                      {letter}
                    </span>
                  ))}
                  <span className="text-2xs font-medium text-(--color-text-secondary)">
                    {bedCountText}
                  </span>
                </div>
                <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                  The bed count cannot be typed here: the server builds the beds from the sharing
                  type and refuses a room whose bed count does not match it. A resident is put into
                  a bed afterwards, from the room page or from the resident page.
                </p>
              </>
            )}
          </div>

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
                        <Image
                          src={url}
                          alt={`Room photo ${idx + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="none" stroke="%2394a3b8" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
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

      {/* What the save commits, and what it does not. The office has to know
          before it commits, because a bed and a rent are not the same thing. */}
      <div className="mt-4 rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
        <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
          What this save commits
        </h3>
        <ul className="mt-3 space-y-2.5">
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The server creates the room with one bed per letter of the sharing type:{' '}
              {bedLetters.join(', ')}. Every bed starts free, with no resident in it and no rent
              attached to it.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The floor counts the room as one of its active rooms, and the server writes a create
              entry in the audit log with the number, the sharing type, the floor and the rent.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The rent on this form is the rent of the room, and it is the number the office starts
              from when a resident is checked in. What a resident owes is raised from the rent on
              their own record, so nothing is billed for this room here.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The amenity states you set here are the state the server holds for this room. When one
              of them moves to degraded or down later, the server pushes that to the residents of
              this room. Until a resident lives here, there is nobody to tell.
            </span>
          </li>
        </ul>

        <div className="mt-4 border-t border-(--border-color) pt-3">
          <p className="tracking-label text-2xs font-bold text-(--color-text-muted) uppercase">
            What this save refuses
          </p>
          <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-text-secondary)">
            <li className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
              <span>
                A room number that already exists (ROOM_NUMBER_EXISTS) and a floor the server does
                not know (FLOOR_NOT_FOUND).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
              <span>
                A rent below ₹1,000 or above ₹50,000, and a sharing type that is not 2, 3 or 4. The
                bed count is never a choice: the server builds it from the sharing type.
              </span>
            </li>
          </ul>
          <p className="text-2xs mt-2 flex items-start gap-2 font-medium text-(--color-text-muted)">
            <Bed className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Nobody is told about a new room. A resident is moved into a bed from the room page, and
            the server writes that move in the audit log.
          </p>
        </div>
      </div>
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
