'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserRound,
  DoorOpen,
  FileText,
  Camera,
  Tag,
  Plus,
  X,
  Link as LinkIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { tenantLabel, roomLabel, roomSublabel } from '@/lib/resource-select-presets';

const complaintSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  roomId: z.string().min(1, 'Room is required'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  category: z.enum([
    'wifi',
    'water',
    'electricity',
    'food_quality',
    'cleaning_room',
    'cleaning_washroom',
    'washing_machine',
    'fridge',
    'lights',
    'noise',
    'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  /** Optional evidence URLs, one per line (max 5). */
  photoUrls: z.string().optional(),
});

type ComplaintFormData = z.infer<typeof complaintSchema>;

const CATEGORY_OPTIONS = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'cleaning_room', label: 'Cleaning - Room' },
  { value: 'cleaning_washroom', label: 'Cleaning - Washroom' },
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'lights', label: 'Lights' },
  { value: 'noise', label: 'Noise' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function ComplaintForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCategory = searchParams.get('category') || '';
  const prefilledFloorId = searchParams.get('floorId') || '';

  const [submitError, setSubmitError] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [photoError, setPhotoError] = useState('');

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ComplaintFormData>({
    resolver: zodResolver(complaintSchema),
    defaultValues: {
      tenantId: '',
      roomId: '',
      title: '',
      description: '',
      category: 'other',
      priority: 'medium',
      photoUrls: '',
    },
  });

  // Set prefilled category from search params (e.g. floor service report flow)
  useEffect(() => {
    if (prefilledCategory) {
      const validCategories = CATEGORY_OPTIONS.map((o) => o.value);
      if (validCategories.includes(prefilledCategory)) {
        setValue('category', prefilledCategory as ComplaintFormData['category']);
      }
    }
  }, [prefilledCategory, setValue]);

  const selectedTenantId = useWatch({ control, name: 'tenantId' });

  // Default the room to the tenant's own room (server enforces it for tenants;
  // admins may override for common-area filings).
  useEffect(() => {
    if (!selectedTenantId) return;
    let cancelled = false;
    api
      .get(`tenants/${selectedTenantId}`)
      .json<{
        success: boolean;
        data: { room?: { _id?: string } | null; roomId?: string };
      }>()
      .then((res) => {
        if (cancelled) return;
        const roomId = res.data.room?._id ?? res.data.roomId;
        if (roomId) setValue('roomId', roomId, { shouldValidate: true });
      })
      .catch(() => {
        // Room stays manual when the lookup fails
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTenantId, setValue]);

  const handleAddPhoto = () => {
    const url = photoInput.trim();
    if (!url) return;
    if (photos.length >= 5) {
      setPhotoError('Maximum 5 photos allowed.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setPhotoError('Photo must be a valid http(s) URL.');
      return;
    }
    const next = [...photos, url];
    setPhotos(next);
    setValue('photoUrls', next.join('\n'), { shouldValidate: true });
    setPhotoInput('');
    setPhotoError('');
  };

  const handleRemovePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    setValue('photoUrls', next.join('\n'), { shouldValidate: true });
  };

  const onSubmit = async (data: ComplaintFormData) => {
    setSubmitError('');
    try {
      const photos = (data.photoUrls ?? '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 5);
      // Whitelist body to match API createComplaintSchema (tenantId required for admin)
      const res = await api
        .post('complaints', {
          json: {
            tenantId: data.tenantId,
            roomId: data.roomId,
            title: data.title.trim(),
            description: data.description.trim(),
            category: data.category,
            priority: data.priority,
            ...(photos.length > 0 ? { photos } : {}),
          },
        })
        .json<{ success: boolean; data?: { _id?: string } }>();
      const createdId = res.data?._id;
      router.push(createdId ? `/complaints/${createdId}` : '/complaints');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Complaint"
      description="File an issue on behalf of a resident"
      backHref="/complaints"
      error={submitError}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/complaints"
            submitLabel="Submit Complaint"
            divided={false}
          />
        }
      >
        <FormSection
          title="Reporter"
          icon={<UserRound />}
          description="Resident and room the issue belongs to"
        >
          <FormGrid>
            <Controller
              name="tenantId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Tenant"
                  endpoint="tenants?isActive=true"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select tenant..."
                  error={err.tenantId?.message}
                  valueKey="_id"
                  labelKey={tenantLabel}
                  dataPath="data"
                />
              )}
            />
            <Controller
              name="roomId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Room"
                  endpoint="rooms?isActive=true"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select room..."
                  error={err.roomId?.message}
                  valueKey="_id"
                  labelKey={roomLabel}
                  sublabelFn={roomSublabel}
                  dataPath="data"
                  helperText={
                    prefilledFloorId
                      ? 'Prefilled from the floor service report flow'
                      : 'Defaults to the tenant room; override for common areas'
                  }
                />
              )}
            />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Issue details"
          icon={<Tag />}
          description="What is wrong and how urgent it is"
          divided
        >
          <FormGrid>
            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              error={err.category?.message}
              {...register('category')}
            />
            <div className="space-y-2">
              <Select
                label="Priority"
                options={PRIORITY_OPTIONS}
                error={err.priority?.message}
                {...register('priority')}
              />
              <div className="flex flex-wrap gap-1" aria-label="Priority scale">
                {PRIORITY_OPTIONS.map((opt) => (
                  <StatusBadge
                    key={opt.value}
                    variant={statusToVariant(opt.value)}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>
          </FormGrid>
          <div className="mt-4 space-y-4">
            <Input
              label="Title"
              placeholder="Brief title for the complaint"
              error={err.title?.message}
              leftIcon={<DoorOpen className="h-4 w-4" />}
              {...register('title')}
            />
            <Textarea
              label="Description"
              rows={4}
              placeholder="Describe the issue in detail"
              error={err.description?.message}
              {...register('description')}
            />
          </div>
        </FormSection>

        <FormSection
          title={`Evidence Photos (${photos.length}/5)`}
          icon={<Camera />}
          description="Optional evidence URLs with instant visual preview"
          divided
        >
          <input type="hidden" {...register('photoUrls')} />

          <div className="space-y-3">
            {photos.length < 5 && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="https://images.example.com/evidence.jpg"
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {photos.map((url, idx) => (
                  <div
                    key={idx}
                    className="group relative flex flex-col items-center overflow-hidden rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) p-2"
                  >
                    <div className="relative h-20 w-full overflow-hidden rounded-sm bg-black/5">
                      <img
                        src={url}
                        alt={`Photo evidence ${idx + 1}`}
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
                    <span className="mt-1.5 w-full truncate text-center text-3xs font-medium text-(--color-text-muted)">
                      Photo {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="flex items-center gap-1 text-xs text-(--color-text-muted)">
              <FileText className="h-3.5 w-3.5" />
              Press Add or Enter to attach photo URLs. You can also attach more from the detail
              page.
            </p>
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}

export default function NewComplaintPage() {
  return (
    <Suspense
      fallback={
        <FormPage
          title="New Complaint"
          description="Report an issue"
          backHref="/complaints"
          isLoading
        >
          {null}
        </FormPage>
      }
    >
      <ComplaintForm />
    </Suspense>
  );
}
