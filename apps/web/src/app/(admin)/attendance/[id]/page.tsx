'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  Clock,
  QrCode,
  Smartphone,
  Monitor,
  FileText,
  CheckCircle,
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

interface AttendanceDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { _id: string; name: string; email: string; phone: string };
    room?: { _id: string; roomNumber: string };
  };
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  method?: string;
  recordedBy?: { _id: string; name: string };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const methodIcons: Record<string, React.ReactNode> = {
  manual: <User className="h-4 w-4" />,
  qr: <QrCode className="h-4 w-4" />,
  app: <Smartphone className="h-4 w-4" />,
};

const methodLabels: Record<string, string> = {
  manual: 'Manual Entry',
  qr: 'QR Code Scan',
  app: 'Mobile App',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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

export default function AttendanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [record, setRecord] = useState<AttendanceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`attendance/${id}`)
      .json<{ success: boolean; data: AttendanceDetail }>()
      .then((res) => setRecord(res.data))
      .catch(() => setError('Failed to load attendance details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !record) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Attendance record not found'}</p>
        </div>
      </div>
    );
  }

  const statusVariant = statusToVariant(record.status);
  const tenantName = record.tenant?.user?.name ?? 'N/A';
  const roomNumber = record.tenant?.room?.roomNumber ?? 'N/A';
  const methodIcon = record.method ? methodIcons[record.method] : <Monitor className="h-4 w-4" />;
  const methodLabel = record.method ? (methodLabels[record.method] ?? record.method) : 'Unknown';

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">Attendance Record</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              {tenantName} · Room {roomNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={statusVariant} label={record.status.replace(/_/g, ' ')} />
          <Button variant="outline" size="icon" onClick={() => router.push(`/attendance/${record._id}/edit`)} title="Edit record">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Date"
          value={formatDate(record.date)}
          icon={<Calendar className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Status"
          value={record.status.replace(/_/g, ' ')}
          icon={<CheckCircle className="h-4 w-4" />}
          variant={statusVariant === 'success' ? 'success' : statusVariant === 'warning' ? 'warning' : 'danger'}
        />
        <StatCard
          title="Check-in"
          value={formatTime(record.checkInTime)}
          icon={<Clock className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Check-out"
          value={formatTime(record.checkOutTime)}
          icon={<Clock className="h-4 w-4" />}
          variant="default"
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
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Date</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDate(record.date)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Clock className="h-5 w-5 text-[color:var(--color-brand-500)]" />Attendance Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <div className="mt-1"><StatusBadge variant={statusVariant} label={record.status.replace(/_/g, ' ')} /></div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Check-in Time</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{formatTime(record.checkInTime)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Check-out Time</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{formatTime(record.checkOutTime)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Method & Recorded By ────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Recording Info</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
            <div className="flex items-center gap-3">
              {methodIcon}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Method</p>
                <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{methodLabel}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-[color:var(--color-text-muted)]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Recorded By</p>
                <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{record.recordedBy?.name ?? 'System'}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Notes ───────────────────────────────── */}
      {record.notes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[color:var(--color-warning-800)]">
            <FileText className="h-5 w-5" />Notes
          </h3>
          <p className="text-sm font-medium text-[color:var(--color-warning-900)]">{record.notes}</p>
        </motion.div>
      )}

      {/* ── Meta ────────────────────────────────── */}
      <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
        Recorded {formatDateTime(record.createdAt)} · Updated {formatDateTime(record.updatedAt)}
      </p>
    </motion.div>
  );
}
