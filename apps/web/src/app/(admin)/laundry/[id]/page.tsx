'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Home,
  Hash,
  FileText,
  Pencil,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

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

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !slot) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Slot not found'}</p>
        </div>
      </div>
    );
  }

  const statusVariant = statusToVariant(slot.status);
  const tenantName = slot.tenant?.user?.name ?? 'N/A';
  const roomNumber = slot.tenant?.room?.roomNumber ?? 'N/A';
  const itemsCount = slot.items ?? 0;

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">Laundry Slot</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              {tenantName} · Room {roomNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={statusVariant} label={slot.status.replace(/_/g, ' ')} />
          <Button variant="outline" size="icon" onClick={() => router.push(`/laundry/${slot._id}/edit`)} title="Edit slot">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </motion.div>

      {/* ── Info Cards ──────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <User className="h-5 w-5 text-[color:var(--color-brand-500)]" />Tenant Information
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="text-lg font-extrabold text-[color:var(--color-text-primary)]">{tenantName}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{roomNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Clock className="h-5 w-5 text-[color:var(--color-brand-500)]" />Slot Details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Date</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDate(slot.slotDate)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Time</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{slot.slotTime}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Items</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{itemsCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <div className="mt-1"><StatusBadge variant={statusVariant} label={slot.status.replace(/_/g, ' ')} /></div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Notes ───────────────────────────────── */}
      {slot.notes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[color:var(--color-warning-800)]">
            <FileText className="h-5 w-5" />Notes
          </h3>
          <p className="whitespace-pre-wrap text-sm font-medium text-[color:var(--color-warning-900)]">{slot.notes}</p>
        </motion.div>
      )}
    </motion.div>
  );
}
