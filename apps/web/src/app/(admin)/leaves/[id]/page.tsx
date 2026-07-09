'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Calendar,
  User,
  MapPin,
  FileText,
  Check,
  X,
  Pencil,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

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

  if (!isLoading && (error || !leave)) {
    return (
      <FormPage
        title="Leave Application"
        description="View leave details"
        backHref="/leaves"
        error={error || 'Leave application not found'}
        maxWidth="4xl"
      />
    );
  }

  const statusVariant = leave ? statusToVariant(leave.status) : 'neutral';
  const tenantName = leave?.tenant?.user?.name ?? 'N/A';
  const roomNumber = leave?.tenant?.room?.roomNumber ?? 'N/A';
  const duration = leave ? getDurationDays(leave.startDate, leave.endDate) : 0;
  const isPending = leave?.status === 'pending';

  return (
    <FormPage
      title="Leave Application"
      description={leave ? `${tenantName} · Room ${roomNumber}` : 'View leave details'}
      backHref="/leaves"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        leave ? (
          <StatusBadge
            variant={statusVariant}
            label={leave.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
      actions={
        leave ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/leaves/${leave._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {leave && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              variant={
                statusVariant === 'success'
                  ? 'success'
                  : statusVariant === 'warning'
                    ? 'warning'
                    : 'danger'
              }
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
                {leave.tenant?.user?.phone && (
                  <DetailRow label="Phone" value={leave.tenant.user.phone} />
                )}
              </DetailList>
            </DetailCard>

            <DetailCard title="Leave Details" icon={<Calendar />}>
              <DetailList>
                <DetailRow label="Start Date" value={formatDate(leave.startDate)} />
                <DetailRow label="End Date" value={formatDate(leave.endDate)} />
                <DetailRow
                  label="Duration"
                  value={`${duration} day${duration !== 1 ? 's' : ''}`}
                />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusVariant}
                      label={leave.status.replace(/_/g, ' ')}
                    />
                  }
                />
              </DetailList>
            </DetailCard>
          </div>

          <DetailCard title="Reason" icon={<FileText />}>
            <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
              {leave.reason || (
                <span className="italic text-[color:var(--color-text-muted)]">
                  No reason provided
                </span>
              )}
            </p>
          </DetailCard>

          {leave.adminNotes && (
            <DetailCard title="Admin Notes" icon={<FileText />} variant="warning">
              <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {leave.adminNotes}
              </p>
            </DetailCard>
          )}

          {isPending && (
            <DetailCard title="Actions">
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
                  <p className="text-sm font-semibold text-[color:var(--color-danger-600)]">
                    {actionError}
                  </p>
                )}
              </div>
            </DetailCard>
          )}

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            Applied {formatDateTime(leave.createdAt)} · Updated{' '}
            {formatDateTime(leave.updatedAt)}
          </p>
        </div>
      )}
    </FormPage>
  );
}
