'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Zap,
  Pencil,
  CheckCircle2,
  Send,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard } from '@/components/ui/DetailCard';

interface RoomEntry {
  roomId?:
    | string
    | {
        _id?: string;
        roomNumber?: string;
        sharingType?: number;
        floorId?: { label?: string } | string;
      };
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  amount: number;
}

interface ElectricityBillDetail {
  _id: string;
  month: string;
  totalBillAmount: number;
  roomEntries: RoomEntry[];
  status: string;
  notes?: string;
  billImageUrl?: string;
  createdAt: string;
}

function roomNumberOf(entry: RoomEntry): string {
  if (!entry.roomId || typeof entry.roomId === 'string') return '—';
  return entry.roomId.roomNumber ?? '—';
}

function roomHref(entry: RoomEntry): string | null {
  if (!entry.roomId || typeof entry.roomId === 'string') return null;
  const id = entry.roomId._id;
  return id ? `/rooms/${id}` : null;
}

export default function ElectricityBillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<ElectricityBillDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api
        .get(`electricity/${params.id}`)
        .json<{ success: boolean; data: ElectricityBillDetail }>();
      setBill(res.data);
    } catch {
      setError('Failed to load electricity bill details');
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const finalize = async () => {
    setActing(true);
    setActionError('');
    setActionMsg('');
    try {
      await api.post(`electricity/${params.id}/finalize`, { json: {} }).json();
      setActionMsg('Bill finalized. You can now distribute charges to invoices.');
      await load();
    } catch {
      setActionError('Failed to finalize bill');
    } finally {
      setActing(false);
    }
  };

  const distribute = async () => {
    setActing(true);
    setActionError('');
    setActionMsg('');
    try {
      const res = await api
        .post(`electricity/${params.id}/distribute`, { json: {} })
        .json<{ success: boolean; data?: { distributed?: number; errors?: number } }>();
      const d = res.data?.distributed ?? 0;
      const e = res.data?.errors ?? 0;
      setActionMsg(`Distribution complete: ${d} invoice(s) updated, ${e} error(s).`);
      await load();
    } catch {
      setActionError('Failed to distribute. Ensure the bill is finalized.');
    } finally {
      setActing(false);
    }
  };

  if (!isLoading && (error || !bill)) {
    return (
      <FormPage
        title="Electricity Bill"
        description="Monthly multi-room bill"
        backHref="/electricity"
        error={error || 'Electricity bill not found'}
        maxWidth="4xl"
      />
    );
  }

  const totalUnits = bill?.roomEntries?.reduce((s, e) => s + (e.unitsConsumed ?? 0), 0) ?? 0;
  const totalRoomAmount =
    bill?.roomEntries?.reduce((s, e) => s + (e.amount ?? 0), 0) ?? 0;

  return (
    <FormPage
      title={bill ? `Electricity · ${bill.month}` : 'Electricity Bill'}
      description="Monthly multi-room bill"
      backHref="/electricity"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        bill ? (
          <StatusBadge
            variant={statusToVariant(bill.status)}
            label={bill.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
      actions={
        bill ? (
          <>
            {bill.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/electricity/${bill._id}/edit`)}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
            {bill.status === 'draft' && (
              <Button size="sm" loading={acting} onClick={finalize}>
                <CheckCircle2 className="h-4 w-4" /> Finalize
              </Button>
            )}
            {bill.status === 'finalized' && (
              <Button size="sm" loading={acting} onClick={distribute}>
                <Send className="h-4 w-4" /> Distribute
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {bill && (
        <div className="space-y-6">
          {actionError && <ErrorBanner message={actionError} />}
          {actionMsg && (
            <div className="rounded-lg border border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] p-3 text-sm font-medium text-[color:var(--color-success-800)]">
              {actionMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Bill"
              value={`₹${bill.totalBillAmount.toLocaleString('en-IN')}`}
              icon={<Zap className="h-4 w-4" />}
              variant="brand"
            />
            <StatCard
              title="Rooms"
              value={String(bill.roomEntries?.length ?? 0)}
              variant="default"
            />
            <StatCard title="Total Units" value={String(totalUnits)} variant="default" />
            <StatCard
              title="Room Total"
              value={`₹${totalRoomAmount.toLocaleString('en-IN')}`}
              variant="default"
            />
          </div>

          <DetailCard title="Room Entries" icon={<Zap />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border-color)] text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    <th className="pb-3 pr-4">Room</th>
                    <th className="pb-3 pr-4">Previous</th>
                    <th className="pb-3 pr-4">Current</th>
                    <th className="pb-3 pr-4">Units</th>
                    <th className="pb-3 pr-4">Rate</th>
                    <th className="pb-3 pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(bill.roomEntries ?? []).map((entry, i) => {
                    const href = roomHref(entry);
                    return (
                      <tr
                        key={i}
                        className="border-b border-[color:var(--border-color)] last:border-b-0"
                      >
                        <td className="py-3 pr-4 font-semibold text-[color:var(--color-text-primary)]">
                          {href ? (
                            <Link
                              href={href}
                              className="text-[color:var(--color-brand-600)] hover:underline"
                            >
                              {roomNumberOf(entry)}
                            </Link>
                          ) : (
                            roomNumberOf(entry)
                          )}
                        </td>
                        <td className="py-3 pr-4">{entry.previousReading}</td>
                        <td className="py-3 pr-4">{entry.currentReading}</td>
                        <td className="py-3 pr-4">{entry.unitsConsumed}</td>
                        <td className="py-3 pr-4">₹{entry.ratePerUnit}</td>
                        <td className="py-3 pr-4 font-semibold">
                          ₹{(entry.amount ?? 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DetailCard>

          {bill.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm text-[color:var(--color-text-primary)]">{bill.notes}</p>
            </DetailCard>
          )}
        </div>
      )}
    </FormPage>
  );
}
