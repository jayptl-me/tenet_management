'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, AlertCircle, User, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { toast } from 'sonner';

const complaintUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
  adminNotes: z.string().max(2000, 'Notes must be under 2000 characters').optional(),
});

type ComplaintUpdateForm = z.infer<typeof complaintUpdateSchema>;

interface ComplaintDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string; floor?: { name: string } };
  };
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
  adminNotes?: string;
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

function getSeverityVariant(severity: string): 'danger' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    default:
      return 'info';
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN');
  } catch {
    return d;
  }
}

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ComplaintUpdateForm>({
    resolver: zodResolver(complaintUpdateSchema),
    defaultValues: { status: 'open', adminNotes: '' },
  });

  useEffect(() => {
    async function fetchComplaint() {
      setIsLoading(true);
      setError('');
      try {
        const res = await api
          .get(`complaints/${params.id}`)
          .json<{ success: boolean; data: ComplaintDetail }>();
        setComplaint(res.data);
        reset({
          status: (res.data.status as ComplaintUpdateForm['status']) ?? 'open',
          adminNotes: res.data.adminNotes ?? '',
        });
      } catch {
        setError('Failed to load complaint details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchComplaint();
  }, [params.id, reset]);

  const onSubmit = async (data: ComplaintUpdateForm) => {
    setIsSaving(true);
    try {
      const res = await api
        .put(`complaints/${params.id}`, { json: data })
        .json<{ success: boolean }>();
      if (res.success) {
        toast.success('Complaint updated successfully');
        setComplaint((prev) =>
          prev ? { ...prev, status: data.status, adminNotes: data.adminNotes ?? '' } : prev,
        );
      } else {
        toast.error('Failed to update complaint');
      }
    } catch {
      toast.error('Failed to update complaint');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoading && (error || !complaint)) {
    return (
      <FormPage
        title="Complaint Details"
        description="View complaint information"
        backHref="/complaints"
        error={error || 'Complaint not found'}
        maxWidth="4xl"
      />
    );
  }

  const severityVariant = complaint ? getSeverityVariant(complaint.severity) : 'info';
  const statusVariant = complaint ? statusToVariant(complaint.status) : 'neutral';

  return (
    <FormPage
      title={complaint?.title ?? 'Complaint Details'}
      description={
        complaint ? `Reported on ${formatDate(complaint.createdAt)}` : 'View complaint information'
      }
      backHref="/complaints"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        complaint ? (
          <StatusBadge
            variant={statusVariant}
            label={complaint.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
    >
      {complaint && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <DetailCard
              title="Complaint Details"
              icon={<AlertCircle />}
              className="lg:col-span-2"
            >
              <DetailList>
                <DetailRow
                  label="Category"
                  value={<span className="capitalize">{complaint.category}</span>}
                />
                <DetailRow
                  label="Severity"
                  value={
                    <StatusBadge variant={severityVariant} label={complaint.severity} />
                  }
                />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusVariant}
                      label={complaint.status.replace(/_/g, ' ')}
                    />
                  }
                />
              </DetailList>

              <div className="mt-4 border-t border-[color:var(--border-color)] pt-4">
                <p className="mb-2 text-xs font-medium text-[color:var(--color-text-muted)]">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-sm font-medium text-[color:var(--color-text-secondary)]">
                  {complaint.description}
                </p>
              </div>

              {complaint.resolution && (
                <div className="mt-4 rounded-[var(--radius-lg)] border border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] p-4">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-success-700)]">
                    Resolution
                  </p>
                  <p className="whitespace-pre-wrap text-sm font-semibold text-[color:var(--color-success-800)]">
                    {complaint.resolution}
                  </p>
                  {complaint.resolvedAt && (
                    <p className="mt-2 text-xs font-semibold text-[color:var(--color-success-600)]">
                      Resolved on: {formatDate(complaint.resolvedAt)}
                    </p>
                  )}
                </div>
              )}
            </DetailCard>

            <DetailCard title="Reported By" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Name"
                  value={complaint.tenant?.user?.name ?? 'N/A'}
                />
                <DetailRow
                  label="Room"
                  value={complaint.tenant?.room?.roomNumber ?? 'N/A'}
                />
                {complaint.tenant?.user?.email && (
                  <DetailRow label="Email" value={complaint.tenant.user.email} />
                )}
                {complaint.tenant?.user?.phone && (
                  <DetailRow label="Phone" value={complaint.tenant.user.phone} />
                )}
                {complaint.tenant?.room?.floor?.name && (
                  <DetailRow label="Floor" value={complaint.tenant.room.floor.name} />
                )}
              </DetailList>
            </DetailCard>
          </div>

          <DetailCard title="Update Status" icon={<FileText />}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="status"
                  className="text-sm font-bold text-[color:var(--color-text-primary)]"
                >
                  Status
                </label>
                <select
                  id="status"
                  className={`w-full rounded-xl border px-4 py-2.5 text-base font-semibold text-[color:var(--color-text-primary)] bg-[color:var(--color-field-bg)] transition-all duration-[var(--transition-duration)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    errors.status
                      ? 'border-[color:var(--color-danger-300)] shadow-[var(--shadow-sm)]'
                      : 'border-[color:var(--border-color)] shadow-[var(--shadow-sm)]'
                  }`}
                  {...register('status')}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.status && (
                  <p className="text-sm font-semibold text-[color:var(--color-danger-600)]">
                    {errors.status.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="adminNotes"
                  className="text-sm font-bold text-[color:var(--color-text-primary)]"
                >
                  Admin Notes
                </label>
                <textarea
                  id="adminNotes"
                  rows={4}
                  className={`w-full rounded-xl border px-4 py-2.5 text-base font-medium text-[color:var(--color-text-primary)] bg-[color:var(--color-field-bg)] placeholder:text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:ring-offset-2 ${
                    errors.adminNotes
                      ? 'border-[color:var(--color-danger-300)] shadow-[var(--shadow-sm)]'
                      : 'border-[color:var(--border-color)] shadow-[var(--shadow-sm)]'
                  }`}
                  placeholder="Add internal notes about this complaint..."
                  {...register('adminNotes')}
                />
                {errors.adminNotes && (
                  <p className="text-sm font-semibold text-[color:var(--color-danger-600)]">
                    {errors.adminNotes.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSaving}
                  loading={isSaving}
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </DetailCard>

          {complaint.updatedAt && (
            <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
              Last updated: {formatDateTime(complaint.updatedAt)}
            </p>
          )}
        </div>
      )}
    </FormPage>
  );
}
