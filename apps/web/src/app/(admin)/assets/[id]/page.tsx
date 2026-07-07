'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Hash, Calendar, Wrench, User, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface AssetDetail {
  _id: string;
  name: string;
  category: string;
  serialNumber?: string;
  location?: string;
  assignedTo?: { _id: string; user?: { _id: string; name: string }; room?: { _id: string; roomNumber: string } };
  status: string;
  quantity: number;
  lowStockThreshold?: number;
  purchaseDate?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true); setError('');
    api.get(`assets/${id}`).json<{ success: boolean; data: AssetDetail }>()
      .then((res) => setAsset(res.data))
      .catch(() => setError('Failed to load asset details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" /></div>;
  }

  if (error || !asset) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Asset not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">{asset.name}</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">Asset Details</p>
          </div>
        </div>
        <StatusBadge variant={statusToVariant(asset.status)} label={asset.status.replace(/_/g, ' ')} />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Identification */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Identification</h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Package className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{asset.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Category</p>
              <p className="mt-0.5 text-[13px] font-semibold capitalize text-[color:var(--color-text-primary)]">{asset.category}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Serial Number</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{asset.serialNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Location</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><MapPin className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{asset.location ?? '—'}</p>
            </div>
          </div>
        </motion.div>

        {/* Status & Assignment */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Status & Assignment</h3>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <StatusBadge variant={statusToVariant(asset.status)} label={asset.status.replace(/_/g, ' ')} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Quantity</p>
              <p className="mt-0.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">{asset.quantity}</p>
            </div>
            {asset.lowStockThreshold != null && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Low Stock Threshold</p>
                <p className="mt-0.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">{asset.lowStockThreshold}</p>
              </div>
            )}
            {asset.assignedTo && (
              <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Assigned To</p>
                <p className="flex items-center gap-1 text-sm font-bold text-[color:var(--color-text-primary)]"><User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{asset.assignedTo.user?.name ?? 'N/A'}</p>
                {asset.assignedTo.room && <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-[color:var(--color-text-muted)]"><MapPin className="h-3.5 w-3.5" />Room {asset.assignedTo.room.roomNumber}</p>}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Dates */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Dates & Service</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Purchase Date</p>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDate(asset.purchaseDate)}</p>
          </div>
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Last Service</p>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Wrench className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDate(asset.lastServiceDate)}</p>
          </div>
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Next Service</p>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Wrench className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDate(asset.nextServiceDate)}</p>
          </div>
        </div>
      </motion.div>

      {asset.notes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Notes</p>
          <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]"><FileText className="mr-1 inline h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{asset.notes}</p>
        </motion.div>
      )}

      <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">Created {formatDateTime(asset.createdAt)} · Updated {formatDateTime(asset.updatedAt)}</p>
    </motion.div>
  );
}
