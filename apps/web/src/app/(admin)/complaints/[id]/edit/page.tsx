'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, Hash, Tag, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import {
  tenantDisplayName,
  tenantRoomNumber,
  type PopulatedTenantRef,
} from '@/lib/api-shapes';

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
] as const;

const categoryValues = CATEGORY_OPTIONS.map((o) => o.value) as [
  (typeof CATEGORY_OPTIONS)[number]['value'],
  ...(typeof CATEGORY_OPTIONS)[number]['value'][],
];

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.enum(categoryValues),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
  adminNotes: z.string().max(2000).optional(),
  /** One URL per line (max 5). */
  photoUrls: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

interface ComplaintDetail {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  adminNotes?: string;
  photos?: string[];
  /** API mapComplaint shape */
  tenant?: PopulatedTenantRef & { bedId?: string };
  /** Legacy / dual-read shape */
  tenantId?: PopulatedTenantRef & { bedId?: string };
  createdAt: string;
}

function resolveTenant(data: ComplaintDetail | null): (PopulatedTenantRef & { bedId?: string }) | null {
  if (!data) return null;
  const t = data.tenant ?? data.tenantId;
  if (!t || typeof t === 'string') return null;
  return t;
}

function tenantPhone(tenant: PopulatedTenantRef | null): string {
  if (!tenant) return 'N/A';
  return tenant.user?.phone ?? tenant.userId?.phone ?? 'N/A';
}

function tenantBed(tenant: (PopulatedTenantRef & { bedId?: string }) | null): string {
  if (!tenant) return 'N/A';
  return tenant.bedId ?? 'N/A';
}

export default function EditComplaintPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [complaintData, setComplaintData] = useState<ComplaintDetail | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`complaints/${id}`)
      .json<{ success: boolean; data: ComplaintDetail }>()
      .then((res) => {
        setComplaintData(res.data);
        const rawCategory = res.data.category ?? 'other';
        const category = (categoryValues as readonly string[]).includes(rawCategory)
          ? (rawCategory as FormData['category'])
          : 'other';
        reset({
          title: res.data.title ?? '',
          description: res.data.description ?? '',
          category,
          priority:
            res.data.priority === 'critical'
              ? 'urgent'
              : ((res.data.priority as FormData['priority']) ?? 'medium'),
          status: (res.data.status as FormData['status']) ?? 'open',
          adminNotes: res.data.adminNotes ?? '',
          photoUrls: (res.data.photos ?? []).join('\n'),
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load complaint');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      // Whitelist keys accepted by updateComplaintSchema
      const photos = (data.photoUrls ?? '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 5);
      await api
        .put(`complaints/${id}`, {
          json: {
            title: data.title,
            description: data.description,
            category: data.category,
            priority: data.priority,
            status: data.status,
            adminNotes: data.adminNotes,
            photos,
          },
        })
        .json();
      router.push('/complaints');
    } catch {
      setSubmitError('Failed to update complaint');
    }
  };

  const tenant = resolveTenant(complaintData);
  const err = errors as Record<string, { message?: string }>;

  const priorityColors: Record<string, string> = {
    low: 'bg-[color:var(--color-neutral-100)] text-[color:var(--color-neutral-700)]',
    medium: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]',
    high: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]',
    urgent:
      'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)] ring-2 ring-[color:var(--color-danger-300)]',
  };

  return (
    <FormPage
      title="Edit Complaint"
      description="Update complaint details and resolution status"
      backHref="/complaints"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {tenant && (
          <DetailCard title="Reported by" icon={<UserRound />}>
            <DetailList>
              <DetailRow label="Name" value={tenantDisplayName(tenant)} />
              <DetailRow
                label="Room"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {tenantRoomNumber(tenant)} · Bed {tenantBed(tenant)}
                  </span>
                }
              />
              <DetailRow label="Phone" value={tenantPhone(tenant)} />
              <DetailRow
                label="Reported"
                value={
                  complaintData?.createdAt
                    ? new Date(complaintData.createdAt).toLocaleDateString('en-IN')
                    : 'N/A'
                }
              />
            </DetailList>
          </DetailCard>
        )}

        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref="/complaints"
              submitLabel="Save Changes"
              divided={false}
            />
          }
        >
          <FormSection
            title="Complaint details"
            description="What was reported and which category it falls under"
          >
            <FormGrid>
              <Input
                label="Title"
                placeholder="Complaint title"
                error={err.title?.message}
                leftIcon={<Tag className="h-4 w-4" />}
                {...register('title')}
              />
              <Select
                label="Category"
                options={[...CATEGORY_OPTIONS]}
                error={err.category?.message}
                {...register('category')}
              />
              <FormFullWidth>
                <Textarea
                  label="Description"
                  rows={3}
                  placeholder="Detailed description of the issue..."
                  error={err.description?.message}
                  {...register('description')}
                />
              </FormFullWidth>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Priority and status"
            description="Triage and track resolution progress"
            divided
          >
            <FormGrid>
              <div className="space-y-2">
                <Select
                  label="Priority"
                  options={priorityOptions}
                  error={err.priority?.message}
                  {...register('priority')}
                />
                <div className="flex flex-wrap gap-1">
                  {priorityOptions.map((opt) => (
                    <span
                      key={opt.value}
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        priorityColors[opt.value],
                      )}
                    >
                      {opt.label}
                    </span>
                  ))}
                </div>
              </div>
              <Select
                label="Status"
                options={statusOptions}
                error={err.status?.message}
                {...register('status')}
              />
            </FormGrid>
          </FormSection>

          <FormSection
            title="Evidence photos"
            description="HTTPS image URLs, one per line (max 5)"
            divided
          >
            <Textarea
              label="Photo URLs"
              rows={3}
              placeholder="https://..."
              error={err.photoUrls?.message}
              {...register('photoUrls')}
            />
          </FormSection>

          <FormSection
            title="Admin notes"
            description="Internal notes visible to staff only"
            divided
          >
            <Textarea
              label="Admin notes"
              rows={3}
              placeholder="Optional internal notes..."
              error={err.adminNotes?.message}
              leftIcon={<MessageSquare className="h-4 w-4" />}
              {...register('adminNotes')}
            />
          </FormSection>
        </FormCard>
      </div>
    </FormPage>
  );
}
