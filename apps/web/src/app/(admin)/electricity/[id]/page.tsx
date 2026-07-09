'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Zap,
  Loader2,
  AlertTriangle,
  Pencil,
  CheckCircle2,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">
            {error || 'Electricity bill not found'}
          </p>
        </div>
      </div>
    );
  }

  const totalUnits = bill.roomEntries?.reduce((s, e) => s + (e.unitsConsumed ?? 0), 0) ?? 0;
  const totalRoomAmount = bill.roomEntries?.reduce((s, e) => s + (e.amount ?? 0), 0) ?? 0;

  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={fadeScaleIn}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Electricity · {bill.month}
            </h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Monthly multi-room bill
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            variant={statusToVariant(bill.status)}
            label={bill.status.replace(/_/g, ' ')}
          />
          {bill.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/electricity/${bill._id}/edit`)}>
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
        </div>
      </motion.div>

      {actionError && <ErrorBanner message={actionError} />}
      {actionMsg && (
        <div className="rounded-lg border border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] p-3 text-sm font-medium text-[color:var(--color-success-800)]">
          {actionMsg}
        </div>
      )}

      <motion.div
        variants={fadeScaleIn}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Total Bill"
          value={`₹${bill.totalBillAmount.toLocaleString('en-IN')}`}
          icon={<Zap className="h-4 w-4" />}
          variant="brand"
        />
        <StatCard title="Rooms" value={String(bill.roomEntries?.length ?? 0)} variant="default" />
        <StatCard title="Total Units" value={String(totalUnits)} variant="default" />
        <StatCard
          title="Room Total"
          value={`₹${totalRoomAmount.toLocaleString('en-IN')}`}
          variant="default"
        />
      </motion.div>

      <motion.div
        variants={fadeScaleIn}
        className="overflow-x-auto rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">
          Room Entries
        </h3>
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
      </motion.div>

      {bill.notes && (
        <motion.div
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6"
        >
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Notes
          </h3>
          <p className="text-sm text-[color:var(--color-text-primary)]">{bill.notes}</p>
        </motion.div>
      )}
    </motion.div>
  );
}
