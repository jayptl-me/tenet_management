'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { User, Phone, Home, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

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
  checkIn?: string;
  checkOut?: string;
  departure?: string;
  status: string;
  approverName?: string;
  approverRelation?: string;
  notes?: string;
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

export default function VisitorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [visitor, setVisitor] = useState<VisitorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`visitors/${id}`)
      .json<{ success: boolean; data: VisitorDetail }>()
      .then((res) => setVisitor(res.data))
      .catch(() => setError('Failed to load visitor details'))
      .finally(() => setIsLoading(false));
  }, [id]);

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

  return (
    <FormPage
      title={visitor?.name ?? 'Visitor Details'}
      description={visitor ? `Visitor ID: ${visitor._id}` : undefined}
      backHref="/visitors"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        visitor ? (
          <StatusBadge
            variant={statusToVariant(visitor.status)}
            label={visitor.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
    >
      {visitor && (
        <div className="space-y-6">
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
                {visitor.approverName && (
                  <DetailRow
                    label="Approved By"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {visitor.approverName}
                        {visitor.approverRelation && ` (${visitor.approverRelation})`}
                      </span>
                    }
                  />
                )}
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
                    {formatDateTime(visitor.checkIn || visitor.actualArrival)}
                  </span>
                }
              />
              <DetailRow
                label="Check Out"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(visitor.checkOut || visitor.departure)}
                  </span>
                }
              />
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    variant={statusToVariant(visitor.status)}
                    label={visitor.status.replace(/_/g, ' ')}
                  />
                }
              />
            </DetailList>
          </DetailCard>

          {visitor.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {visitor.notes}
              </p>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
