'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

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

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
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

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !complaint) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Complaint not found'}</p>
        </div>
      </div>
    );
  }

  const severityVariant = getSeverityVariant(complaint.severity);
  const statusVariant = statusToVariant(complaint.status);

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              {complaint.title}
            </h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Reported on {formatDate(complaint.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge variant={statusVariant} label={complaint.status.replace(/_/g, ' ')} />
      </motion.div>

      {/* ── Main detail cards ──────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Complaint details */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Complaint Details</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Category</p>
              <p className="mt-1 text-sm font-bold capitalize text-[color:var(--color-text-primary)]">{complaint.category}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Severity</p>
              <div className="mt-1">
                <StatusBadge variant={severityVariant} label={complaint.severity} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <div className="mt-1">
                <StatusBadge variant={statusVariant} label={complaint.status.replace(/_/g, ' ')} />
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-[color:var(--border-color)] pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Description
            </p>
            <p className="whitespace-pre-wrap text-sm font-medium text-[color:var(--color-text-secondary)]">
              {complaint.description}
            </p>
          </div>

          {complaint.resolution && (
            <div className="mt-4 rounded-xl border border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] p-4 shadow-[var(--shadow-sm)]">
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
        </motion.div>

        {/* Reporter info card */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Reported By</h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="mt-1 text-sm font-bold text-[color:var(--color-text-primary)]">
                {complaint.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room</p>
              <p className="mt-1 text-sm font-bold text-[color:var(--color-text-primary)]">
                {complaint.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
            {complaint.tenant?.user?.email && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Email</p>
                <p className="mt-1 text-sm font-medium text-[color:var(--color-text-secondary)]">
                  {complaint.tenant.user.email}
                </p>
              </div>
            )}
            {complaint.tenant?.user?.phone && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Phone</p>
                <p className="mt-1 text-sm font-medium text-[color:var(--color-text-secondary)]">
                  {complaint.tenant.user.phone}
                </p>
              </div>
            )}
            {complaint.tenant?.room?.floor?.name && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Floor</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--color-text-secondary)]">
                  {complaint.tenant.room.floor.name}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Status update form ──────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Update Status</h3>
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
              className={`w-full rounded-xl border px-4 py-2.5 text-base font-semibold text-[color:var(--color-text-primary)] bg-[color:var(--color-surface-50)] transition-all duration-[var(--transition-duration)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
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
              <p className="text-sm font-semibold text-[color:var(--color-danger-600)]">{errors.status.message}</p>
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
              className={`w-full rounded-xl border px-4 py-2.5 text-base font-medium text-[color:var(--color-text-primary)] bg-[color:var(--color-surface-50)] placeholder:text-[color:var(--color-text-muted)] transition-all duration-[var(--transition-duration)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-400)] focus:ring-offset-2 ${
                errors.adminNotes
                  ? 'border-[color:var(--color-danger-300)] shadow-[var(--shadow-sm)]'
                  : 'border-[color:var(--border-color)] shadow-[var(--shadow-sm)]'
              }`}
              placeholder="Add internal notes about this complaint..."
              {...register('adminNotes')}
            />
            {errors.adminNotes && (
              <p className="text-sm font-semibold text-[color:var(--color-danger-600)]">{errors.adminNotes.message}</p>
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
      </motion.div>

      {/* ── Meta ────────────────────────────────── */}
      {complaint.updatedAt && (
        <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
          Last updated: {formatDateTime(complaint.updatedAt)}
        </p>
      )}
    </motion.div>
  );
}