'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  User,
  Home,
  FileText,
  Check,
  X,
  Pencil,
  ListChecks,
  BedDouble,
  Building2,
  MessageCircle,
  Copy,
  ExternalLink,
  Phone,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { LeaveLifecycleStepper } from '@/components/ui/LeaveLifecycleStepper';
import { LeaveAttendanceImpact } from '@/components/ui/LeaveAttendanceImpact';
import { TenantStayCalendar } from '@/components/ui/TenantStayCalendar';
import { Textarea } from '@/components/ui/Textarea';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';

interface LeaveDetail {
  _id: string;
  tenant?: {
    _id: string;
    bedId?: string | null;
    user?: { _id: string; name: string; email: string; phone: string };
    room?: { _id: string; roomNumber: string; floor?: { label?: string } | null };
  };
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  adminNotes?: string;
  approvedByName?: string | null;
  approvedAt?: string | null;
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
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`leaves/${id}`)
      .json<{ success: boolean; data: LeaveDetail }>()
      .then((res) => setLeave(res.data))
      .catch(async (err) => {
        setError((await parseApiError(err)).message);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!id) return;
    setActionLoading(action);
    setActionError('');
    try {
      // Reject schema requires a JSON body (adminNotes optional); approve has no body schema
      // but send {} so Content-Type is consistent across clients.
      const res = await api
        .put(`leaves/${id}/${action}`, {
          json: action === 'reject' ? { adminNotes: rejectNotes } : {},
        })
        .json<{ success: boolean; data: LeaveDetail }>();
      if (res.success) {
        setLeave(res.data);
        setShowRejectPrompt(false);
      } else {
        setActionError('Failed to update leave status');
      }
    } catch (err) {
      setActionError((await parseApiError(err)).message);
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
  const bedId = leave?.tenant?.bedId ?? null;
  const floorLabel = leave?.tenant?.room?.floor?.label ?? null;
  const tenantPhone = leave?.tenant?.user?.phone;
  const duration = leave ? getDurationDays(leave.startDate, leave.endDate) : 0;
  const isPending = leave?.status === 'pending';

  return (
    <FormPage
      title="Leave Application"
      description={
        leave
          ? `${tenantName} · Room ${roomNumber}${bedId ? ` · Bed ${bedId}` : ''} · ${duration} day${duration !== 1 ? 's' : ''}`
          : 'View leave details'
      }
      backHref="/leaves"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        leave ? (
          <StatusBadge variant={statusVariant} label={leave.status.replace(/_/g, ' ')} />
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
            Review
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

          <DetailCard title="Lifecycle progress" icon={<ListChecks />}>
            <LeaveLifecycleStepper status={leave.status} />
          </DetailCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailCard
              title="Tenant Information"
              icon={<User />}
              action={
                leave.tenant?._id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/tenants/${leave.tenant!._id}`)}
                  >
                    View tenant
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ) : undefined
              }
            >
              <DetailList>
                <DetailRow
                  label="Name"
                  value={
                    leave.tenant?._id ? (
                      <Link
                        href={`/tenants/${leave.tenant._id}`}
                        className="inline-flex items-center gap-1 text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                      >
                        <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {tenantName}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {tenantName}
                      </span>
                    )
                  }
                />
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {roomNumber}
                    </span>
                  }
                />
                <DetailRow
                  label="Bed"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {bedId ?? 'N/A'}
                    </span>
                  }
                />
                {floorLabel && (
                  <DetailRow
                    label="Floor"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {floorLabel}
                      </span>
                    }
                  />
                )}
                {tenantPhone && (
                  <DetailRow
                    label="Phone"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {tenantPhone}
                      </span>
                    }
                  />
                )}
              </DetailList>
              {tenantPhone && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--border-color)] pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(
                        generateWhatsAppUrl(
                          tenantPhone,
                          `Hi ${tenantName}, regarding your leave ${leave.startDate} to ${leave.endDate}...`,
                        ),
                        '_blank',
                        'noopener,noreferrer',
                      );
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void copyToClipboard(
                        `${tenantName} | Room ${roomNumber}${bedId ? ` Bed ${bedId}` : ''} | Leave ${leave.startDate} to ${leave.endDate} | ${leave.status}`,
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Copy summary
                  </Button>
                </div>
              )}
            </DetailCard>

            <DetailCard title="Leave Details" icon={<Calendar />}>
              <DetailList>
                <DetailRow label="Start Date" value={formatDate(leave.startDate)} />
                <DetailRow label="End Date" value={formatDate(leave.endDate)} />
                <DetailRow label="Duration" value={`${duration} day${duration !== 1 ? 's' : ''}`} />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge variant={statusVariant} label={leave.status.replace(/_/g, ' ')} />
                  }
                />
                {leave.approvedByName && (
                  <DetailRow
                    label="Decided by"
                    value={`${leave.approvedByName}${leave.approvedAt ? ` on ${formatDate(leave.approvedAt)}` : ''}`}
                  />
                )}
              </DetailList>
            </DetailCard>
          </div>

          <DetailCard title="Leave Window" icon={<Calendar />}>
            <TenantStayCalendar
              moveInDate={leave.startDate}
              moveOutDate={leave.endDate}
              isActive={leave.status !== 'rejected' && leave.status !== 'cancelled'}
            />
          </DetailCard>

          <DetailCard title="Attendance impact" icon={<Calendar />}>
            <LeaveAttendanceImpact
              tenantId={leave.tenant?._id}
              fromDate={leave.startDate}
              toDate={leave.endDate}
              status={leave.status}
            />
          </DetailCard>

          <DetailCard title="Reason" icon={<FileText />}>
            <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
              {leave.reason || (
                <span className="text-[color:var(--color-text-muted)] italic">
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
              <div className="flex flex-col gap-4">
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
                  {!showRejectPrompt ? (
                    <Button
                      variant="danger"
                      size="md"
                      onClick={() => setShowRejectPrompt(true)}
                      disabled={actionLoading !== null}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setShowRejectPrompt(false)}
                      disabled={actionLoading !== null}
                    >
                      Cancel
                    </Button>
                  )}
                  {actionError && (
                    <p className="text-sm font-semibold text-[color:var(--color-danger-600)]">
                      {actionError}
                    </p>
                  )}
                </div>

                {showRejectPrompt && (
                  <div className="rounded-lg border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-4">
                    <p className="mb-2 text-sm font-medium text-[color:var(--color-danger-900)]">
                      Reason for Rejection (Optional)
                    </p>
                    <Textarea
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      placeholder="Enter note or reason for rejection..."
                      rows={3}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowRejectPrompt(false)}
                        disabled={actionLoading !== null}
                      >
                        Back
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleAction('reject')}
                        loading={actionLoading === 'reject'}
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DetailCard>
          )}

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            Applied {formatDateTime(leave.createdAt)} · Updated {formatDateTime(leave.updatedAt)}
          </p>
        </div>
      )}
    </FormPage>
  );
}
