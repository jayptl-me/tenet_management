import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Hash, Banknote } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { findInvalidPhotoLine, parsePhotoUrls } from '@/lib/photo-urls';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchedSharing = Number(watch('sharingType'));
  const isDownsizeBlocked = currentOccupancy > 0 && watchedSharing < currentOccupancy;

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
                <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] p-2.5 text-xs text-[color:var(--color-warning-800)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-warning-600)]" />
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
            <Textarea
              label="Photo URLs"
              rows={3}
              placeholder="Paste image URLs (one per line, e.g. https://...)"
              helperText="Add public image links for this room. One URL per line."
              error={err.photoUrls?.message}
              {...register('photoUrls')}
            />
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
