'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Hash,
  Banknote,
  Link as LinkIcon,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
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
import { useApiQuery } from '@/hooks/useApiQuery';
import { errorMessage } from '@/lib/query';
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
  _id: string;
  roomNumber: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  floorId?: string;
  sharingType: number;
  monthlyRent: number;
  isActive: boolean;
  description?: string;
  photos?: string[];
  roomAmenities?: Array<{ amenityKey: string; status: string }>;
  beds?: Array<{
    bedId: string;
    isOccupied: boolean;
    tenantId?: string | null;
    tenantName?: string | null;
  }>;
  occupancyCount?: number;
}

/** The bed letters the server uses, in the order it uses them. */
const BED_IDS = ['A', 'B', 'C', 'D'] as const;

/**
 * The repack the server performs when the sharing type of a room changes.
 *
 * The rule is the server's own (apps/api/src/routes/rooms.ts:84-123): the
 * occupied beds are sorted by their letter and packed into the first slots of
 * the new sharing type. A resident in bed C of a 3-sharing room therefore
 * moves to bed B of a 2-sharing room, and the server writes the new bed onto
 * that resident's record (apps/api/src/routes/rooms.ts:544-553). It sends no
 * message: the resident finds out from the portal.
 */
function repackPreview(
  beds: RoomData['beds'],
  newSharingType: number,
): {
  refused: boolean;
  moves: Array<{ from: string; to: string; tenantName: string | null }>;
  occupied: number;
} {
  const occupied = (beds ?? [])
    .filter((bed) => bed.isOccupied)
    .sort((left, right) => left.bedId.localeCompare(right.bedId));
  if (occupied.length > newSharingType) {
    return { refused: true, moves: [], occupied: occupied.length };
  }
  const slots = BED_IDS.slice(0, newSharingType);
  const moves: Array<{ from: string; to: string; tenantName: string | null }> = [];
  occupied.forEach((bed, index) => {
    const slot = slots[index];
    if (slot !== undefined && slot !== bed.bedId) {
      moves.push({ from: bed.bedId, to: slot, tenantName: bed.tenantName ?? null });
    }
  });
  return { refused: false, moves, occupied: occupied.length };
}

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const queryClient = useQueryClient();
  // The skeleton is shown while the record is still on its way. It is derived
  // from the query rather than pushed by an effect, so a record that never
  // arrives cannot leave the page spinning for ever.
  const [submitError, setSubmitError] = useState('');
  const [roomAmenityDefs, setRoomAmenityDefs] = useState<RoomAmenityDef[]>([]);

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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  /**
   * The record, read through the shared query stack.
   */
  const { data: fetchedRoom, error: roomError } = useApiQuery<RoomData>(
    ['rooms', roomId],
    `rooms/${roomId}`,
    { enabled: Boolean(roomId) },
  );

  // The record and the occupancy are only ever read, so they are derived from
  // the query instead of being copied into state by an effect.
  const roomRecord = fetchedRoom && !Array.isArray(fetchedRoom) ? fetchedRoom : null;
  const currentOccupancy = roomRecord
    ? (roomRecord.beds?.filter((b) => b.isOccupied).length ?? roomRecord.occupancyCount ?? 0)
    : 0;

  // The skeleton is shown while the record is still on its way. It is derived
  // from the query, so a record that never arrives shows the error state
  // instead of a page that spins for ever.
  const isLoading = !roomRecord && !roomError;

  const [photos, setPhotos] = useState<string[]>([]);
  // The photos are the operator's to change, so they are state. They start
  // from the record, and they are seeded during the render that sees a new
  // record - React's documented way to adjust state when something changes.
  const photoSeedKey = roomRecord
    ? `${roomRecord._id}:${(roomRecord.photos ?? []).join(',')}`
    : null;
  const [photoSeed, setPhotoSeed] = useState<string | null>(null);
  if (photoSeedKey !== null && photoSeed !== photoSeedKey) {
    setPhotoSeed(photoSeedKey);
    setPhotos(roomRecord?.photos ?? []);
  }

  const watchedSharing = Number(useWatch({ control, name: 'sharingType' }));
  const isDownsizeBlocked = currentOccupancy > 0 && watchedSharing < currentOccupancy;

  /**
   * What the sharing type change moves.
   *
   * The server packs the occupied beds into the first letters of the new
   * sharing type, so a resident whose bed letter changes is moved.
   */
  const sharingMoves = useMemo(
    () => repackPreview(roomRecord?.beds, watchedSharing),
    [roomRecord, watchedSharing],
  );

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

  /**
   * The record, read through the shared query stack.
   */

  useEffect(() => {
    if (!roomId) return;

    api
      .get('app-config')
      .json<{ success: boolean; data: IAppConfig }>()
      .then((configRes) => {
        const defs = (configRes.data.amenityDefinitions ?? [])
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
      });
  }, [roomId]);

  useEffect(() => {
    if (!roomRecord) return;
    const d = roomRecord;

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

    for (const a of roomAmenityDefs) {
      const existing = existingAmenities.find(
        (ea: { amenityKey: string; status: string }) => ea.amenityKey === a.key,
      );
      defaults[`amenity_${a.key}`] = existing?.status ?? 'operational';
    }

    reset(defaults);
    // The amenity definitions arrive after the record, so the form is filled
    // again once they are known.
  }, [roomRecord, roomAmenityDefs, reset]);

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
      /**
       * The amenity list the save writes.
       *
       * The room may carry an amenity the app config no longer defines, and
       * the save keeps it: dropping a status the office recorded would make
       * the room lose a service without anybody deciding it.
       */
      const amenityStatus = new Map<string, string>();
      for (const amenity of roomRecord?.roomAmenities ?? []) {
        amenityStatus.set(amenity.amenityKey, amenity.status);
      }
      for (const a of roomAmenityDefs) {
        const value = data[`amenity_${a.key}`];
        amenityStatus.set(a.key, typeof value === 'string' ? value : 'operational');
      }
      const roomAmenities = [...amenityStatus.entries()].map(([amenityKey, status]) => ({
        amenityKey,
        status,
      }));

      const photoList = parsePhotoUrls(
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
            photos: photoList,
            roomAmenities,
          },
        })
        .json<{ success: boolean }>();

      // The room is re-read from the server, so the page the operator lands on
      // shows the state the server committed and not a local claim about it.
      // The bed map of that page is the proof that the residents moved.
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
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
      description="Identity, rent, sharing type and amenity health for this room"
      backHref={`/rooms/${roomId}`}
      error={submitError || errorMessage(roomError)}
      isLoading={isLoading}
      maxWidth="form"
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
                    <span className="font-bold">The server refuses this:</span> the room holds{' '}
                    {currentOccupancy} resident{currentOccupancy === 1 ? '' : 's'} and a{' '}
                    {watchedSharing} sharing room has {watchedSharing} bed
                    {watchedSharing === 1 ? '' : 's'}. Check a resident out or move one first.
                  </div>
                </div>
              )}
              {!isDownsizeBlocked && sharingMoves.moves.length > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-(--radius-md) border border-(--color-warning-300) bg-(--color-warning-50) p-2.5 text-xs text-(--color-warning-800)">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--color-warning-600)" />
                  <div>
                    <span className="font-bold">This save moves residents:</span>{' '}
                    {sharingMoves.moves
                      .map(
                        (move) =>
                          `${move.tenantName ?? 'A resident'} from bed ${move.from} to bed ${move.to}`,
                      )
                      .join(', ')}
                    . The server writes the new bed onto their record and sends no message, so they
                    find out from the portal.
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

      {/* What the save moves, and what the server will not do. The office has
          to know before it commits: a bed move changes where someone sleeps. */}
      <div className="mt-4 rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
        <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
          What this save does
        </h3>
        <ul className="mt-3 space-y-2.5">
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The sharing type rebuilds the beds: the taken beds are packed into the first letters
              of the new sharing type. The server writes the new bed onto the record of every
              resident it moves, and it tells nobody.
              {sharingMoves.moves.length > 0
                ? ` On this room that means: ${sharingMoves.moves
                    .map(
                      (move) =>
                        `${move.tenantName ?? 'a resident'} from bed ${move.from} to bed ${move.to}`,
                    )
                    .join(', ')}.`
                : ' On this room no resident moves.'}
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              An amenity that moves to degraded or down is pushed to the residents of this room as a
              service update, and one that comes back to operational tells them it works again. A
              room with nobody in it has nobody to tell.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The rent of the room is the number the office starts from when a resident is checked
              in. What every resident owes is raised from the rent on their own record, so this save
              changes what nobody owes and raises no bill.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              Unchecking Active takes the room out of the lists a new resident is picked from, and
              the server recounts the rooms on the floor. The residents of the room are not told.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              Moving the room to another floor recounts the rooms on both floors. The residents stay
              where they sleep and are not told.
            </span>
          </li>
        </ul>
        <p className="text-2xs mt-3 border-t border-(--border-color) pt-3 font-medium text-(--color-text-muted)">
          The server writes one update entry in the audit log with the fields that moved, and the
          record is the proof. No message reaches the residents of this room about a rent, a floor
          or a sharing type.
        </p>
      </div>
    </FormPage>
  );
}
