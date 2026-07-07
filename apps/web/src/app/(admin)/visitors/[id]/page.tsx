'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Home, Calendar, Clock, FileText, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface VisitorDetail {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: { _id: string; user?: { name: string; email?: string; phone?: string }; room?: { roomNumber: string } };
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
    return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function VisitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [visitor, setVisitor] = useState<VisitorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true); setError('');
    api.get(`visitors/${id}`).json<{ success: boolean; data: VisitorDetail }>()
      .then((res) => setVisitor(res.data))
      .catch(() => setError('Failed to load visitor details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" /></div>;
  }

  if (error || !visitor) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Visitor not found'}</p>
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
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">{visitor.name}</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">Visitor ID: {visitor._id}</p>
          </div>
        </div>
        <StatusBadge variant={statusToVariant(visitor.status)} label={visitor.status.replace(/_/g, ' ')} />
      </motion.div>

      {/* Visitor & Tenant Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Visitor Information</h3>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{visitor.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Phone</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{visitor.phone}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Purpose</p>
              <p className="mt-0.5 text-[13px] font-semibold capitalize text-[color:var(--color-text-primary)]">{visitor.purpose}</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Visiting</h3>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Tenant</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{visitor.tenant?.user?.name ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{visitor.tenant?.room?.roomNumber ?? 'N/A'}</p>
            </div>
            {visitor.approverName && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Approved By</p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><CheckCircle className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{visitor.approverName}{visitor.approverRelation && ` (${visitor.approverRelation})`}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Timeline */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Timeline</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Expected Arrival</p><p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDateTime(visitor.expectedArrival)}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Check In</p><p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDateTime(visitor.checkIn || visitor.actualArrival)}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Check Out</p><p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Clock className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDateTime(visitor.checkOut || visitor.departure)}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p><div className="mt-1"><StatusBadge variant={statusToVariant(visitor.status)} label={visitor.status.replace(/_/g, ' ')} /></div></div>
        </div>
      </motion.div>

      {/* Notes */}
      {visitor.notes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Notes</h3>
          <p className="flex items-start gap-1 text-sm text-[color:var(--color-text-secondary)]"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-text-muted)]" /><span className="whitespace-pre-wrap">{visitor.notes}</span></p>
        </motion.div>
      )}
    </motion.div>
  );
}
