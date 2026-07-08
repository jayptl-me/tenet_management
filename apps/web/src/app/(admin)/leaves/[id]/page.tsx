'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  FileText,
  Check,
  X,
  Pencil,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface LeaveDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { _id: string; name: string; email: string; phone: string };
    room?: { _id: string; roomNumber: string };
  };
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function getDurationDays(start: string, end: string): number {
  try {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } catch {
    return 0;
  }
}

export default function LeaveDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [leave, setLeave] = useState<LeaveDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`leaves/${id}`)
      .json<{ success: boolean; data: LeaveDetail }>()
      .then((res) => setLeave(res.data))
      .catch(() => setError('Failed to load leave details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!id) return;
    setActionLoading(action);
    setActionError('');
    try {
      const res = await api
        .put(`leaves/${id}/${action}`)
        .json<{ success: boolean; data: LeaveDetail }>();
      if (res.success) {
        setLeave(res.data);
      } else {
        setActionError('Failed to update leave status');
      }
    } catch {
      setActionError('Failed to update leave status');
    } finally {
      setActionLoading(null);
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
  if (error || !leave) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Leave application not found'}</p>
        </div>
      </div>
    );
  }

  const statusVariant = statusToVariant(leave.status);
  const tenantName = leave.tenant?.user?.name ?? 'N/A';
  const roomNumber = leave.tenant?.room?.roomNumber ?? 'N/A';
  const duration = getDurationDays(leave.startDate, leave.endDate);
  const isPending = leave.status === 'pending';

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">Leave Application</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              {tenantName} · Room {roomNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={statusVariant} label={leave.status.replace(/_/g, ' ')} />
          <Button variant="outline" size="icon" onClick={() => router.push(`/leaves/${leave._id}/edit`)} title="Edit leave">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Start Date"
          value={formatDate(leave.startDate)}
          icon={<Calendar className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="End Date"
          value={formatDate(leave.endDate)}
          icon={<Calendar className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Duration"
          value={`${duration} day${duration !== 1 ? 's' : ''}`}
          icon={<FileText className="h-4 w-4" />}
          variant="brand"
        />
        <StatCard
          title="Status"
          value={leave.status.replace(/_/g, ' ')}
          icon={<Check className="h-4 w-4" />}
          variant={statusVariant === 'success' ? 'success' : statusVariant === 'warning' ? 'warning' : 'danger'}
        />
      </motion.div>

      {/* ── Info Cards ──────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <User className="h-5 w-5 text-[color:var(--color-brand-500)]" />Tenant Information
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{tenantName}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <MapPin className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{roomNumber}
              </p>
            </div>
            {leave.tenant?.user?.phone && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Phone</p>
                <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{leave.tenant.user.phone}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Calendar className="h-5 w-5 text-[color:var(--color-brand-500)]" />Leave Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Start Date</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{formatDate(leave.startDate)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">End Date</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{formatDate(leave.endDate)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Duration</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{duration} day{duration !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <div className="mt-1"><StatusBadge variant={statusVariant} label={leave.status.replace(/_/g, ' ')} /></div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Reason ──────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
          <FileText className="h-5 w-5 text-[color:var(--color-brand-500)]" />Reason
        </h3>
        <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          {leave.reason || <span className="italic text-[color:var(--color-text-muted)]">No reason provided</span>}
        </p>
      </motion.div>

      {/* ── Admin Notes ─────────────────────────── */}
      {leave.adminNotes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[color:var(--color-warning-800)]">
            <FileText className="h-5 w-5" />Admin Notes
          </h3>
          <p className="text-sm font-medium text-[color:var(--color-warning-900)]">{leave.adminNotes}</p>
        </motion.div>
      )}

      {/* ── Approve / Reject Actions ────────────── */}
      {isPending && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleAction('approve')}
              disabled={actionLoading !== null}
              loading={actionLoading === 'approve'}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => handleAction('reject')}
              disabled={actionLoading !== null}
              loading={actionLoading === 'reject'}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
            {actionError && (
              <p className="text-sm font-semibold text-[color:var(--color-danger-600)]">{actionError}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Meta ────────────────────────────────── */}
      <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
        Applied {formatDateTime(leave.createdAt)} · Updated {formatDateTime(leave.updatedAt)}
      </p>
    </motion.div>
  );
}
