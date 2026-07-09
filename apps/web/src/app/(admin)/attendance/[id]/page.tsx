'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
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
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

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

  if (!isLoading && (error || !record)) {
    return (
      <FormPage
        title="Attendance Record"
        description="View attendance details"
        backHref="/attendance"
        error={error || 'Attendance record not found'}
        maxWidth="4xl"
      />
    );
  }

  const statusVariant = record ? statusToVariant(record.status) : 'neutral';
  const tenantName = record?.tenant?.user?.name ?? 'N/A';
  const roomNumber = record?.tenant?.room?.roomNumber ?? 'N/A';
  const methodIcon = record?.method
    ? methodIcons[record.method]
    : <Monitor className="h-4 w-4" />;
  const methodLabel = record?.method
    ? (methodLabels[record.method] ?? record.method)
    : 'Unknown';

  return (
    <FormPage
      title="Attendance Record"
      description={record ? `${tenantName} · Room ${roomNumber}` : 'View attendance details'}
      backHref="/attendance"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        record ? (
          <StatusBadge
            variant={statusVariant}
            label={record.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
      actions={
        record ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/attendance/${record._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {record && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              variant={
                statusVariant === 'success'
                  ? 'success'
                  : statusVariant === 'warning'
                    ? 'warning'
                    : 'danger'
              }
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
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailCard title="Tenant Information" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Name"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {tenantName}
                    </span>
                  }
                />
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {roomNumber}
                    </span>
                  }
                />
                <DetailRow
                  label="Date"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDate(record.date)}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Attendance Details" icon={<Clock />}>
              <DetailList>
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusVariant}
                      label={record.status.replace(/_/g, ' ')}
                    />
                  }
                />
                <DetailRow label="Check-in Time" value={formatTime(record.checkInTime)} />
                <DetailRow label="Check-out Time" value={formatTime(record.checkOutTime)} />
              </DetailList>
            </DetailCard>
          </div>

          <DetailCard title="Recording Info" icon={<CheckCircle />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <div className="flex items-center gap-3">
                  {methodIcon}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      Method
                    </p>
                    <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                      {methodLabel}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-[color:var(--color-text-muted)]" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      Recorded By
                    </p>
                    <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                      {record.recordedBy?.name ?? 'System'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>

          {record.notes && (
            <DetailCard title="Notes" icon={<FileText />} variant="warning">
              <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {record.notes}
              </p>
            </DetailCard>
          )}

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            Recorded {formatDateTime(record.createdAt)} · Updated {formatDateTime(record.updatedAt)}
          </p>
        </div>
      )}
    </FormPage>
  );
}
