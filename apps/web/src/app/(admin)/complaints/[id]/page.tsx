'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
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

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="space-y-6">
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Complaint not found'}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const tenantName = complaint.tenant?.user?.name ?? 'N/A';
  const roomNumber = complaint.tenant?.room?.roomNumber ?? 'N/A';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">
              {complaint.title}
            </h2>
            <p className="text-surface-500 mt-0.5 text-sm">
              Reported on{' '}
              {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(complaint.status)}
          label={complaint.status.replace(/_/g, ' ')}
        />
      </div>

      {/* Main detail cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Complaint details */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Complaint Details
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Category
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold capitalize">
                {complaint.category}
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Severity
              </p>
              <p className="mt-1">
                <StatusBadge
                  variant={
                    complaint.severity === 'critical'
                      ? 'danger'
                      : complaint.severity === 'high'
                        ? 'warning'
                        : 'info'
                  }
                  label={complaint.severity}
                />
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Status
              </p>
              <p className="mt-1">
                <StatusBadge
                  variant={statusToVariant(complaint.status)}
                  label={complaint.status.replace(/_/g, ' ')}
                />
              </p>
            </div>
          </div>

          <div className="border-[color:var(--color-surface-200)] mt-6 border-t-2 pt-4">
            <p className="text-surface-500 mb-2 text-xs font-semibold uppercase tracking-wider">
              Description
            </p>
            <p className="text-surface-700 whitespace-pre-wrap text-sm">{complaint.description}</p>
          </div>

          {complaint.resolution && (
            <div className="border-success-300 bg-success-50 mt-4 rounded-md border-[length:var(--bw-default)] p-4">
              <p className="text-success-700 mb-1 text-xs font-semibold uppercase tracking-wider">
                Resolution
              </p>
              <p className="text-success-800 whitespace-pre-wrap text-sm">{complaint.resolution}</p>
              {complaint.resolvedAt && (
                <p className="text-success-600 mt-2 text-xs">
                  Resolved on:{' '}
                  {new Date(complaint.resolvedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tenant info card */}
        <div className="bg-surface-50 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">Reported By</h3>
          <div className="space-y-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Name
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold">{tenantName}</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Room
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold">{roomNumber}</p>
            </div>
            {complaint.tenant?.user?.email && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Email
                </p>
                <p className="text-surface-700 mt-1 text-sm">{complaint.tenant.user.email}</p>
              </div>
            )}
            {complaint.tenant?.user?.phone && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Phone
                </p>
                <p className="text-surface-700 mt-1 text-sm">{complaint.tenant.user.phone}</p>
              </div>
            )}
            {complaint.tenant?.room?.floor?.name && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Floor
                </p>
                <p className="text-surface-700 mt-1 text-sm">{complaint.tenant.room.floor.name}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status update form */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">Update Status</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            error={errors.status?.message}
            {...register('status')}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="adminNotes"
              className="text-surface-800 font-display text-sm font-semibold"
            >
              Admin Notes
            </label>
            <textarea
              id="adminNotes"
              rows={4}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Add internal notes about this complaint..."
              {...register('adminNotes')}
            />
            {errors.adminNotes && (
              <p className="text-danger-600 text-sm font-medium">{errors.adminNotes.message}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Meta */}
      {complaint.updatedAt && (
        <p className="text-surface-400 text-right text-xs">
          Last updated: {new Date(complaint.updatedAt).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}
