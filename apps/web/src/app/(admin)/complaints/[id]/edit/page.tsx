'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, Hash, Tag, AlertTriangle, MessageSquare } from 'lucide-react';
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

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
  adminNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
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
  tenantId?: {
    _id?: string;
    userId?: { name?: string; phone?: string };
    roomId?: { roomNumber?: string };
    bedId?: string;
  };
  createdAt: string;
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
        reset({
          title: res.data.title ?? '',
          description: res.data.description ?? '',
          category: res.data.category ?? '',
          priority: (res.data.priority as FormData['priority']) ?? 'medium',
          status: (res.data.status as FormData['status']) ?? 'open',
          adminNotes: res.data.adminNotes ?? '',
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
      await api.put(`complaints/${id}`, { json: data }).json();
      router.push('/complaints');
    } catch {
      setSubmitError('Failed to update complaint');
    }
  };

  const tenant = complaintData?.tenantId;
  const err = errors as Record<string, { message?: string }>;

  const priorityColors: Record<string, string> = {
    low: 'bg-[color:var(--color-neutral-100)] text-[color:var(--color-neutral-700)]',
    medium: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]',
    high: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]',
    critical:
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
              <DetailRow label="Name" value={tenant.userId?.name ?? 'N/A'} />
              <DetailRow
                label="Room"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {tenant.roomId?.roomNumber ?? 'N/A'} · Bed {tenant.bedId ?? 'N/A'}
                  </span>
                }
              />
              <DetailRow label="Phone" value={tenant.userId?.phone ?? 'N/A'} />
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
              <Input
                label="Category"
                placeholder="e.g. WiFi, Water, Electricity"
                error={err.category?.message}
                leftIcon={<AlertTriangle className="h-4 w-4" />}
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
