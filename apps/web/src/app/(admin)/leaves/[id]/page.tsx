'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, User, MapPin, FileText, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

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
        .put(`leaves/${id}`, { json: { status: action === 'approve' ? 'approved' : 'rejected' } })
        .json<{
          success: boolean;
          data: LeaveDetail;
        }>();
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

  if (!leave) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
          <p className="font-display text-danger-800 text-lg font-semibold">
            Leave application not found
          </p>
        </div>
      </div>
    );
  }

  const isPending = leave.status === 'pending';
  const canApprove = isPending && actionLoading === null;
  const canReject = isPending && actionLoading === null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            Leave Application
          </h2>
          <p className="text-surface-500 text-sm">View & manage leave request</p>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
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
                    {leave.tenant?.user?.name ?? 'N/A'}
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
                    {leave.tenant?.room?.roomNumber ?? 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {leave.tenant?.user?.phone && (
              <div className="border-surface-200 bg-surface-50 rounded-md border-[length:var(--bw-default)] p-3">
                <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                  Contact Phone
                </p>
                <p className="text-surface-900 font-[family:var(--font-body)] text-sm font-semibold">
                  {leave.tenant.user.phone}
                </p>
              </div>
            )}
          </section>

          {/* Dates & Status */}
          <section className="space-y-4">
            <h3 className="font-display text-surface-900 border-surface-200 border-b-2 pb-2 text-lg font-bold">
              Leave Details
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    Start Date
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {new Date(leave.startDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="text-surface-400 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-display text-surface-400 text-xs uppercase tracking-wide">
                    End Date
                  </p>
                  <p className="text-surface-900 font-[family:var(--font-body)] text-base font-semibold">
                    {new Date(leave.endDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                  Status
                </p>
                <StatusBadge
                  variant={statusToVariant(leave.status)}
                  label={leave.status.replace(/_/g, ' ')}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Reason Section */}
        <section className="border-[color:var(--color-surface-200)] mt-6 border-t-2 pt-4">
          <div className="flex items-start gap-3">
            <FileText className="text-surface-400 mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                Reason
              </p>
              <p className="text-surface-600 font-[family:var(--font-body)] text-sm leading-relaxed">
                {leave.reason || 'No reason provided'}
              </p>
            </div>
          </div>
        </section>

        {/* Admin Notes Section */}
        {leave.adminNotes && (
          <section className="border-surface-200 mt-4 border-t-2 pt-4">
            <div className="flex items-start gap-3">
              <FileText className="text-surface-400 mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-display text-surface-400 mb-1 text-xs uppercase tracking-wide">
                  Admin Notes
                </p>
                <p className="text-surface-600 font-[family:var(--font-body)] text-sm leading-relaxed">
                  {leave.adminNotes}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Approve/Reject actions */}
        {isPending && (
          <section className="border-surface-200 mt-6 border-t-2 pt-4">
            <div className="flex items-center gap-3">
              <p className="font-display text-surface-700 text-sm font-bold">Actions:</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleAction('approve')}
                disabled={!canApprove}
                className="bg-success-600 border-success-700 hover:bg-success-700 text-[color:var(--color-surface-50)]"
              >
                {actionLoading === 'approve' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleAction('reject')}
                disabled={!canReject}
              >
                {actionLoading === 'reject' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Reject
              </Button>
            </div>
            {actionError && (
              <p className="text-danger-600 mt-2 text-sm font-semibold">{actionError}</p>
            )}
          </section>
        )}
      </div>

      {/* Metadata */}
      <p className="text-surface-400 text-right text-xs">
        Applied on{' '}
        {new Date(leave.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        • Updated{' '}
        {new Date(leave.updatedAt).toLocaleDateString('en-IN', {
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
