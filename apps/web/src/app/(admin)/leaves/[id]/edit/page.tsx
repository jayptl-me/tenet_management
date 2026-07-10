'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CalendarDays, UserRound, Hash, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

interface LeaveDetail {
  _id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  adminNotes?: string;
  tenant?: {
    _id: string;
    user?: { _id: string; name: string; phone: string };
    room?: { _id: string; roomNumber: string };
    bedId?: string;
  };
  approvedAt?: string;
  approvedByName?: string;
  createdAt: string;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function daysBetween(from: string, to: string): number {
  const f = new Date(from);
  const t = new Date(to);
  return Math.max(1, Math.floor((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function LeaveForm() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [leaveData, setLeaveData] = useState<LeaveDetail | null>(null);
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get(`leaves/${id}`)
      .json<{ success: boolean; data: LeaveDetail }>()
      .then((res) => {
        setLeaveData(res.data);
        setAdminNotes(res.data.adminNotes ?? '');
      })
      .catch(() => setSubmitError('Failed to load leave application'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleApprove = async () => {
    setActionLoading('approve');
    setSubmitError('');
    try {
      await api.put(`leaves/${id}/approve`).json();
      router.push('/leaves');
    } catch {
      setSubmitError('Failed to approve leave');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading('reject');
    setSubmitError('');
    try {
      await api
        .put(`leaves/${id}/reject`, {
          json: { adminNotes: adminNotes.trim() || undefined },
        })
        .json();
      router.push('/leaves');
    } catch {
      setSubmitError('Failed to reject leave');
    } finally {
      setActionLoading(null);
    }
  };

  const tenant = leaveData?.tenant;

  return (
    <FormPage
      title="Leave Application"
      description="Approve or reject this leave request"
      backHref="/leaves"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      {leaveData && (
        <div className="space-y-5">
          {tenant && (
            <DetailCard title="Applicant" icon={<UserRound />}>
              <DetailList>
                <DetailRow label="Name" value={tenant.user?.name ?? 'N/A'} />
                <DetailRow label="Phone" value={tenant.user?.phone ?? 'N/A'} />
                <DetailRow
                  label="Room & Bed"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {tenant.room?.roomNumber ?? 'N/A'} · Bed {tenant.bedId ?? 'N/A'}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>
          )}

          <FormCard>
            <FormSection title="Leave details" description="Period, reason, and current status">
              <FormGrid cols={2}>
                <div className={clsx(surfaceNestedClass, 'p-4')}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    Period
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-primary)]">
                    <CalendarDays className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                    {formatDate(leaveData.fromDate)} — {formatDate(leaveData.toDate)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[color:var(--color-text-secondary)]">
                    {daysBetween(leaveData.fromDate, leaveData.toDate)} day
                    {daysBetween(leaveData.fromDate, leaveData.toDate) !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className={clsx(surfaceNestedClass, 'p-4')}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    Status
                  </p>
                  <span
                    className={clsx(
                      'mt-1.5 inline-block rounded-full px-3 py-1 text-xs font-bold',
                      leaveData.status === 'pending' &&
                        'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]',
                      leaveData.status === 'approved' &&
                        'bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]',
                      leaveData.status === 'rejected' &&
                        'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]',
                    )}
                  >
                    {leaveData.status.charAt(0).toUpperCase() + leaveData.status.slice(1)}
                  </span>
                  {leaveData.approvedByName && (
                    <p className="mt-1 text-xs font-medium text-[color:var(--color-text-muted)]">
                      by {leaveData.approvedByName}
                      {leaveData.approvedAt && ` on ${formatDate(leaveData.approvedAt)}`}
                    </p>
                  )}
                </div>
              </FormGrid>
            </FormSection>

            <FormSection title="Reason" divided>
              <div className={clsx(surfaceNestedClass, 'p-4')}>
                <p className="text-sm leading-relaxed text-[color:var(--color-text-primary)]">
                  {leaveData.reason}
                </p>
              </div>
            </FormSection>

            {leaveData.status === 'pending' && (
              <FormSection
                title="Admin notes"
                description="Optional notes visible to the tenant"
                divided
              >
                <FormFullWidth>
                  <Textarea
                    label="Admin notes"
                    rows={3}
                    placeholder="Reason for rejection or any additional notes..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    maxLength={500}
                  />
                  <p className="mt-1 text-right text-[11px] text-[color:var(--color-text-muted)]">
                    {adminNotes.length}/500
                  </p>
                </FormFullWidth>
              </FormSection>
            )}

            {leaveData.status === 'pending' && (
              <FormActions
                loading={false}
                cancelHref="/leaves"
                submitLabel="Approve"
                hideSubmit
                divided
                leading={
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      type="button"
                      loading={actionLoading === 'reject'}
                      onClick={handleReject}
                    >
                      <X className="h-4 w-4 text-[color:var(--color-danger-600)]" />
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      type="button"
                      loading={actionLoading === 'approve'}
                      onClick={handleApprove}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                }
              />
            )}

            {leaveData.status !== 'pending' && (
              <FormActions loading={false} cancelHref="/leaves" submitLabel="" hideSubmit divided />
            )}

            {leaveData.adminNotes && (
              <FormSection title="Existing admin notes" divided>
                <div className={clsx(surfaceNestedClass, 'p-4')}>
                  <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                    {leaveData.adminNotes}
                  </p>
                </div>
              </FormSection>
            )}
          </FormCard>
        </div>
      )}
    </FormPage>
  );
}

export default function EditLeavePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <LeaveForm />
    </Suspense>
  );
}
