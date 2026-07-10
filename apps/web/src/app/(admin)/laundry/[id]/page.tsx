'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, User, Home, Hash, FileText, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

interface LaundrySlotDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { name: string; phone?: string };
    room?: { roomNumber: string };
  };
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function LaundryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [slot, setSlot] = useState<LaundrySlotDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`laundry-slots/${id}`)
      .json<{ success: boolean; data: LaundrySlotDetail }>()
      .then((res) => setSlot(res.data))
      .catch(() => setError('Failed to load slot details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!isLoading && (error || !slot)) {
    return (
      <FormPage
        title="Laundry Slot"
        description="View laundry slot details"
        backHref="/laundry"
        error={error || 'Slot not found'}
        maxWidth="4xl"
      />
    );
  }

  const statusVariant = slot ? statusToVariant(slot.status) : 'neutral';
  const tenantName = slot?.tenant?.user?.name ?? 'N/A';
  const roomNumber = slot?.tenant?.room?.roomNumber ?? 'N/A';
  const itemsCount = slot?.items ?? 0;

  return (
    <FormPage
      title="Laundry Slot"
      description={slot ? `${tenantName} · Room ${roomNumber}` : 'View laundry slot details'}
      backHref="/laundry"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        slot ? (
          <StatusBadge variant={statusVariant} label={slot.status.replace(/_/g, ' ')} />
        ) : undefined
      }
      actions={
        slot ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/laundry/${slot._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {slot && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Date"
              value={formatDate(slot.slotDate)}
              icon={<Calendar className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Time Slot"
              value={slot.slotTime}
              icon={<Clock className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Items"
              value={itemsCount.toString()}
              icon={<Hash className="h-4 w-4" />}
              variant={itemsCount > 0 ? 'brand' : 'default'}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailCard title="Tenant Information" icon={<User />}>
              <DetailList>
                <DetailRow label="Name" value={tenantName} />
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {roomNumber}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Slot Details" icon={<Clock />}>
              <DetailList>
                <DetailRow
                  label="Date"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDate(slot.slotDate)}
                    </span>
                  }
                />
                <DetailRow
                  label="Time"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {slot.slotTime}
                    </span>
                  }
                />
                <DetailRow
                  label="Items"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {itemsCount}
                    </span>
                  }
                />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge variant={statusVariant} label={slot.status.replace(/_/g, ' ')} />
                  }
                />
              </DetailList>
            </DetailCard>
          </div>

          {slot.notes && (
            <DetailCard title="Notes" icon={<FileText />} variant="warning">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {slot.notes}
              </p>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
