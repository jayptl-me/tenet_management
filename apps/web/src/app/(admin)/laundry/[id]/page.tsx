'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, User, Home, Hash, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

interface LaundrySlotDetail {
  _id: string;
  tenant?: { _id: string; user?: { name: string; phone?: string }; room?: { roomNumber: string } };
  slotDate: string;
  slotTime: string;
  items?: number;
  status: string;
  notes?: string;
  createdAt: string;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-t-[color:var(--color-brand-500)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !slot) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] p-4 text-sm font-semibold text-[color:var(--color-danger-800)]">
          {error || 'Slot not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-[color:var(--color-surface-900)]">
              Laundry Slot
            </h2>
            <p className="text-sm text-[color:var(--color-surface-500)]">ID: {slot._id}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(slot.status)}
          label={slot.status.replace(/_/g, ' ')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tenant Info */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display mb-4 text-lg font-bold text-[color:var(--color-surface-900)]">
            <User className="mr-1 inline h-4 w-4" />
            Tenant
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                Name
              </p>
              <p className="text-sm font-semibold text-[color:var(--color-surface-900)]">
                {slot.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                Room
              </p>
              <p className="flex items-center gap-1 text-sm text-[color:var(--color-surface-700)]">
                <Home className="h-3.5 w-3.5" />
                {slot.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Slot Info */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display mb-4 text-lg font-bold text-[color:var(--color-surface-900)]">
            <Clock className="mr-1 inline h-4 w-4" />
            Slot Details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                Date
              </p>
              <p className="flex items-center gap-1 text-sm text-[color:var(--color-surface-700)]">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(slot.slotDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                Time
              </p>
              <p className="flex items-center gap-1 text-sm text-[color:var(--color-surface-700)]">
                <Clock className="h-3.5 w-3.5" />
                {slot.slotTime}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                Items
              </p>
              <p className="flex items-center gap-1 text-sm text-[color:var(--color-surface-700)]">
                <Hash className="h-3.5 w-3.5" />
                {slot.items ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-surface-500)]">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge
                  variant={statusToVariant(slot.status)}
                  label={slot.status.replace(/_/g, ' ')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {slot.notes && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display mb-4 text-lg font-bold text-[color:var(--color-surface-900)]">
            <FileText className="mr-1 inline h-4 w-4" />
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-sm text-[color:var(--color-surface-700)]">{slot.notes}</p>
        </div>
      )}
    </div>
  );
}
