'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Ban, Building2, Check, DoorOpen, ExternalLink, Info, UserRound, X } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { FormCard } from '@/components/ui/FormCard';
import { FormPage } from '@/components/ui/FormPage';
import { FormSection } from '@/components/ui/FormSection';
import { LeaveAttendanceImpact } from '@/components/ui/LeaveAttendanceImpact';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';
import { useApiQuery } from '@/hooks/useApiQuery';

// ── Shapes ────────────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /leaves/:id apps/api/src/routes/leaves.ts:450-494

interface LeaveDetail {
  _id: string;
  tenant?: {
    _id?: string;
    bedId?: string | null;
    user?: { _id?: string; name?: string; phone?: string } | null;
    room?: { _id?: string; roomNumber?: string; floor?: { label?: string } | null } | null;
  } | null;
  fromDate?: string;
  toDate?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  adminNotes?: string;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromOf(leave: LeaveDetail): string {
  return leave.fromDate ?? leave.startDate ?? '';
}

function toOf(leave: LeaveDetail): string {
  return leave.toDate ?? leave.endDate ?? '';
}

/** The days of the window, counted the way the server counts them. */
function inclusiveDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── The decision screen ───────────────────────────────────────────────────────

/**
 * The review of one leave request.
 *
 * The component is mounted with the record in hand, so the note the office
 * writes starts from what the record holds without a second read.
 */
function LeaveReview({ leave }: { leave: LeaveDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [adminNotes, setAdminNotes] = useState(leave.adminNotes ?? '');
  const [actionBusy, setActionBusy] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const from = fromOf(leave);
  const to = toOf(leave);
  const days = inclusiveDays(from, to);
  const status = leave.status ?? '';
  const isPending = status === 'pending';
  const tenant = leave.tenant ?? null;
  const tenantId = tenant?._id ?? '';

  const runDecision = async (action: 'approve' | 'reject' | 'cancel') => {
    setActionBusy(action);
    setActionError('');
    try {
      if (action === 'approve') {
        await api
          .put(`leaves/${leave._id}/approve`, { json: {} })
          .json<{ success: boolean; data: LeaveDetail }>();
      } else if (action === 'reject') {
        await api
          .put(`leaves/${leave._id}/reject`, { json: { adminNotes: adminNotes.trim() } })
          .json<{ success: boolean; data: LeaveDetail }>();
      } else {
        await api.post(`leaves/${leave._id}/cancel`, { json: {} }).json();
      }
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      router.push(`/leaves/${leave._id}`);
    } catch (err) {
      // The server's answer is the one that matters: it refuses with
      // LEAVE_NOT_PENDING or OVERLAPPING_LEAVE.
      setActionError((await parseApiError(err)).message);
    } finally {
      setActionBusy(null);
      setConfirmCancel(false);
    }
  };

  return (
    <FormPage
      title="Decide on this leave"
      description={`${tenant?.user?.name ?? 'Unknown resident'} · ${formatDate(from)} to ${formatDate(to)} · ${days} day${days === 1 ? '' : 's'}`}
      backHref={`/leaves/${leave._id}`}
      error={actionError}
      maxWidth="form"
      badge={<StatusBadge variant={statusToVariant(status)} label={status.replace(/_/g, ' ')} />}
    >
      <div className="space-y-4">
        <DetailCard title="The resident" icon={<UserRound />}>
          <DetailList>
            <DetailRow
              label="Name"
              value={
                tenantId ? (
                  <Link
                    href={`/tenants/${tenantId}`}
                    className="inline-flex items-center gap-1 font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                  >
                    {tenant?.user?.name ?? 'View the resident'}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  (tenant?.user?.name ?? 'Unknown resident')
                )
              }
            />
            <DetailRow label="Phone" value={tenant?.user?.phone ?? 'Not on the record'} />
            <DetailRow
              label="Room and bed"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <DoorOpen className="h-3.5 w-3.5 text-(--color-text-muted)" />
                  {tenant?.room?.roomNumber ?? 'No room'} · Bed {tenant?.bedId ?? 'no bed'}
                </span>
              }
            />
            {tenant?.room?.floor?.label && (
              <DetailRow
                label="Floor"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    {tenant.room.floor.label}
                  </span>
                }
              />
            )}
          </DetailList>
        </DetailCard>

        <FormCard>
          <FormSection
            title="The request"
            description="The window, the reason and what the request would write"
          >
            <DetailList>
              <DetailRow label="From" value={formatDate(from)} />
              <DetailRow label="To" value={formatDate(to)} />
              <DetailRow label="Days" value={`${days} day${days === 1 ? '' : 's'}`} />
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    variant={statusToVariant(status)}
                    label={status.replace(/_/g, ' ')}
                  />
                }
              />
              {leave.approvedByName && (
                <DetailRow
                  label="Decided by"
                  value={`${leave.approvedByName}${
                    leave.approvedAt ? ` on ${formatDate(leave.approvedAt)}` : ''
                  }`}
                />
              )}
            </DetailList>

            <div className="mt-4">
              <p className="text-2xs font-bold tracking-wider text-(--color-text-muted) uppercase">
                The reason the resident gave
              </p>
              <p className="mt-1 text-sm leading-relaxed text-(--color-text-primary)">
                {leave.reason ?? 'No reason was given'}
              </p>
            </div>

            <div className="mt-4">
              <LeaveAttendanceImpact
                tenantId={tenantId}
                fromDate={from}
                toDate={to}
                status={status}
              />
            </div>
          </FormSection>

          {!isPending && leave.adminNotes && (
            <FormSection title="The reason the office wrote" divided>
              <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                {leave.adminNotes}
              </p>
            </FormSection>
          )}

          {isPending ? (
            <FormSection title="The decision" divided>
              <ul className="space-y-2 text-sm leading-relaxed text-(--color-text-secondary)">
                <li>
                  <strong className="text-(--color-text-primary)">Approve</strong> marks each of the{' '}
                  {days} day{days === 1 ? '' : 's'} of the window as an on-leave record on the
                  attendance board, writes the entry in the audit log and pushes a service_update
                  notification to the resident. The approval carries no note: the server takes no
                  body on that route, so the resident reads the outcome alone.
                </li>
                <li>
                  <strong className="text-(--color-text-primary)">Reject</strong> keeps the request
                  on file with the reason of the office, writes the entry in the audit log and
                  pushes a service_update notification that carries the reason in its body.
                </li>
                <li>
                  <strong className="text-(--color-text-primary)">Cancel</strong> withdraws the
                  request, writes the entry in the audit log and pushes a service_update
                  notification that says the leave was cancelled by the PG office.
                </li>
                <li className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" />
                  The rent does not change in any of the three: the monthly bill is raised from the
                  resident&apos;s own record.
                </li>
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  loading={actionBusy === 'approve'}
                  disabled={actionBusy !== null}
                  onClick={() => void runDecision('approve')}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                {!showReject && (
                  <Button
                    variant="danger"
                    disabled={actionBusy !== null}
                    onClick={() => setShowReject(true)}
                  >
                    <X className="h-4 w-4" />
                    Reject with a reason
                  </Button>
                )}
                <Button
                  variant="outline"
                  loading={actionBusy === 'cancel'}
                  disabled={actionBusy !== null}
                  onClick={() => setConfirmCancel(true)}
                >
                  <Ban className="h-4 w-4" />
                  Cancel the request
                </Button>
              </div>

              {showReject && (
                <div className="mt-4">
                  <Textarea
                    label="Reason for the rejection"
                    rows={3}
                    placeholder="Why the leave is refused..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    maxLength={500}
                    helperText="The reason travels to the resident in the notification: the portal leave card does not show the office notes, so a rejection without a reason tells the resident nothing."
                  />
                  <p className="text-2xs mt-1 text-right font-medium text-(--color-text-muted)">
                    {adminNotes.length}/500
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="danger"
                      loading={actionBusy === 'reject'}
                      disabled={actionBusy !== null || adminNotes.trim().length === 0}
                      onClick={() => void runDecision('reject')}
                    >
                      <X className="h-4 w-4" />
                      Reject with this reason
                    </Button>
                    <Button
                      variant="outline"
                      disabled={actionBusy !== null}
                      onClick={() => setShowReject(false)}
                    >
                      Keep the request open
                    </Button>
                  </div>
                </div>
              )}
            </FormSection>
          ) : (
            <FormSection title="The decision" divided>
              <p className="text-sm leading-relaxed text-(--color-text-secondary)">
                This request was {status.replace(/_/g, ' ')}
                {leave.approvedByName ? ` by ${leave.approvedByName}` : ''}
                {leave.approvedAt ? ` on ${formatDate(leave.approvedAt)}` : ''}. The server refuses
                to move it again: only a pending request can be approved, rejected or cancelled.
              </p>
            </FormSection>
          )}
        </FormCard>
      </div>

      <ConfirmModal
        open={confirmCancel}
        title="Cancel this request"
        message="The server sets the status to cancelled, writes the entry in the audit log and pushes a service_update notification to the resident: the body says the leave was cancelled by the PG office. The attendance board is not touched, and the request cannot be answered afterwards."
        confirmLabel="Cancel the request"
        cancelLabel="Keep it open"
        variant="warning"
        loading={actionBusy === 'cancel'}
        onConfirm={() => void runDecision('cancel')}
        onCancel={() => setConfirmCancel(false)}
      />
    </FormPage>
  );
}

// ── The page ──────────────────────────────────────────────────────────────────

export default function EditLeavePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  /**
   * The record, read with the shared query stack.
   *
   * The page is re-read from the server after every write, so the office always
   * decides on what the server holds and not on a copy.
   */
  const {
    data: rawLeave,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<LeaveDetail>(['leaves', 'detail', id], `leaves/${id}`, { enabled: !!id });

  const leave: LeaveDetail | null =
    rawLeave && typeof rawLeave === 'object' && !Array.isArray(rawLeave) ? rawLeave : null;

  if (!isLoading && (queryError || !leave)) {
    return (
      <FormPage
        title="Decide on this leave"
        description="One leave application"
        backHref="/leaves"
        error={queryError?.message ?? 'The server reports no leave for this id.'}
        maxWidth="form"
      />
    );
  }

  if (!leave) {
    return (
      <FormPage
        title="Decide on this leave"
        description="One leave application"
        backHref="/leaves"
        isLoading
        maxWidth="form"
      />
    );
  }

  // The key resets the screen when another record is opened, so the note the
  // office writes starts from the record in hand.
  return leave ? <LeaveReview key={leave._id} leave={leave} /> : null;
}
