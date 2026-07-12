'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { User, Phone, Home, Calendar, Clock, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { VisitorLifecycleActions } from '@/components/ui/VisitorLifecycleActions';

interface VisitorDetail {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: {
    _id: string;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string };
  };
  expectedArrival?: string;
  actualArrival?: string;
  actualDeparture?: string;
  status: string;
  createdAt: string;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function statusToDisplayLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function VisitorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [visitor, setVisitor] = useState<VisitorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get(`visitors/${id}`).json<{ success: boolean; data: VisitorDetail }>();
      setVisitor(res.data);
    } catch {
      setError('Failed to load visitor details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLifecycleAction = async (action: string) => {
    if (!visitor) return;
    setActionError('');
    try {
      const res =
        action === 'cancel'
          ? await api
              .put(`visitors/${visitor._id}`, { json: { status: 'cancelled' } })
              .json<{ success: boolean; data: VisitorDetail }>()
          : await api
              .post(`visitors/${visitor._id}/${action}`, { json: {} })
              .json<{ success: boolean; data: VisitorDetail }>();
      setVisitor(res.data);
    } catch {
      setActionError(`Failed to ${action} visitor`);
    }
  };

  if (!isLoading && (error || !visitor)) {
    return (
      <FormPage
        title="Visitor Details"
        description="View visitor information"
        backHref="/visitors"
        error={error || 'Visitor not found'}
        maxWidth="4xl"
      />
    );
  }

  // Model: expected | arrived | departed | cancelled
  // approve -> expected; arrive -> arrived; depart -> departed; cancel -> cancelled
  const status = visitor?.status ?? '';

  return (
    <FormPage
      title={visitor?.name ?? 'Visitor Details'}
      description={visitor ? `Visitor ID: ${visitor._id}` : undefined}
      backHref="/visitors"
      isLoading={isLoading}
      maxWidth="4xl"
      error={actionError}
      badge={
        visitor ? (
          <StatusBadge
            variant={statusToVariant(visitor.status)}
            label={statusToDisplayLabel(visitor.status)}
          />
        ) : undefined
      }
    >
      {visitor && (
        <div className="space-y-6">
          <DetailCard title="Lifecycle actions" icon={<CheckCircle />}>
            <VisitorLifecycleActions
              visitorId={visitor._id}
              status={status}
              onAction={handleLifecycleAction}
            />
          </DetailCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard title="Visitor Information" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Name"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {visitor.name}
                    </span>
                  }
                />
                <DetailRow
                  label="Phone"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {visitor.phone}
                    </span>
                  }
                />
                <DetailRow
                  label="Purpose"
                  value={<span className="capitalize">{visitor.purpose}</span>}
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Visiting" icon={<Home />}>
              <DetailList>
                <DetailRow
                  label="Tenant"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {visitor.tenant?.user?.name ?? 'N/A'}
                    </span>
                  }
                />
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {visitor.tenant?.room?.roomNumber ?? 'N/A'}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>
          </div>

          <DetailCard title="Timeline" icon={<Clock />}>
            <DetailList>
              <DetailRow
                label="Expected Arrival"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(visitor.expectedArrival)}
                  </span>
                }
              />
              <DetailRow
                label="Check In"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(visitor.actualArrival)}
                  </span>
                }
              />
              <DetailRow
                label="Check Out"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(visitor.actualDeparture)}
                  </span>
                }
              />
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    variant={statusToVariant(visitor.status)}
                    label={statusToDisplayLabel(visitor.status)}
                  />
                }
              />
            </DetailList>
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
