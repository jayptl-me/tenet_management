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
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
          <p className="font-display text-danger-800 text-lg font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
          <p className="font-display text-danger-800 text-lg font-semibold">
            Attendance record not found
          </p>
        </div>
      </div>
    );
  }

  const methodIcon = record.method ? methodIcons[record.method] : <Monitor className="h-4 w-4" />;
  const methodLabel = record.method ? (methodLabels[record.method] ?? record.method) : 'Unknown';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            Attendance Record
          </h2>
          <p className="text-surface-500 text-sm">View attendance details</p>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Tenant & Room Info */}
          <section className="space-y-4">
            <h3 className="font-display text-surface-900 border-surface-200 border-b-2 pb-2 text-lg font-bold">
              Tenant Information
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Tenant
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {record.tenant?.user?.name ?? 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Room
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {record.tenant?.room?.roomNumber ?? 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Date
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {new Date(record.date).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Status & Times */}
          <section className="space-y-4">
            <h3 className="font-display text-surface-900 border-surface-200 border-b-2 pb-2 text-lg font-bold">
              Attendance Details
            </h3>

            <div className="space-y-3">
              <div>
                <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                  Status
                </p>
                <StatusBadge
                  variant={statusToVariant(record.status)}
                  label={record.status.replace(/_/g, ' ')}
                />
              </div>

              <div className="flex items-center gap-3">
                <Clock className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Check-in Time
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {record.checkInTime
                      ? new Date(record.checkInTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Check-out Time
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {record.checkOutTime
                      ? new Date(record.checkOutTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Method & Recorded By Section */}
        <section className="border-surface-200 mt-6 border-t-2 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="border-surface-200 bg-surface-50 flex items-center gap-3 rounded-md border-[length:var(--bw-default)] p-3">
              {methodIcon}
              <div>
                <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                  Method
                </p>
                <p className="text-surface-900 font-[family:var(--font-body)] text-sm font-semibold">
                  {methodLabel}
                </p>
              </div>
            </div>

            <div className="border-surface-200 bg-surface-50 flex items-center gap-3 rounded-md border-[length:var(--bw-default)] p-3">
              <CheckCircle className="text-surface-400 h-5 w-5 shrink-0" />
              <div>
                <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                  Recorded By
                </p>
                <p className="text-surface-900 font-[family:var(--font-body)] text-sm font-semibold">
                  {record.recordedBy?.name ?? 'System'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Notes Section */}
        {record.notes && (
          <section className="border-surface-200 mt-4 border-t-2 pt-4">
            <div className="flex items-start gap-3">
              <FileText className="text-surface-400 mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                  Notes
                </p>
                <p className="text-surface-600 font-[family:var(--font-body)] text-sm leading-relaxed">
                  {record.notes}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Metadata */}
      <p className="text-surface-400 text-right text-xs">
        Recorded{' '}
        {new Date(record.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        • Updated{' '}
        {new Date(record.updatedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}
