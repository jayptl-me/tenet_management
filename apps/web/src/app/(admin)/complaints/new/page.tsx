'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, DoorOpen, FileText, Camera, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
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
          title="Evidence"
          icon={<Camera />}
          description="Optional photo URLs (max 5)"
          divided
        >
          <Textarea
            label="Photo URLs"
            rows={2}
            placeholder="One HTTPS image URL per line (max 5)"
            error={err.photoUrls?.message}
            {...register('photoUrls')}
          />
          <p className="mt-1 flex items-center gap-1 text-xs text-[color:var(--color-text-muted)]">
            <FileText className="h-3 w-3" />
            More photos can be attached from the complaint detail page.
          </p>
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
