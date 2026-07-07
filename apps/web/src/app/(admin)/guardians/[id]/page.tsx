'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail, User, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface GuardianDetail {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  tenant?: { _id: string; user?: { _id: string; name: string; email: string; phone: string }; room?: { _id: string; roomNumber: string } };
  isEmergencyContact: boolean;
  isActive: boolean;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

export default function GuardianDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true); setError('');
    api.get(`guardians/${id}`).json<{ success: boolean; data: GuardianDetail }>()
      .then((res) => setGuardian(res.data))
      .catch(() => setError('Failed to load guardian details'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" /></div>;
  }

  if (error || !guardian) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Guardian not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={fadeScaleIn} className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">{guardian.name}</h2>
          <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">Guardian Details</p>
        </div>
      </motion.div>

      {/* Main details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Personal Information</h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Full Name</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{guardian.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Phone</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{guardian.phone}</p>
            </div>
            {guardian.email && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Email</p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]"><Mail className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{guardian.email}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Relation</p>
              <p className="mt-0.5 text-[13px] font-semibold capitalize text-[color:var(--color-text-primary)]">{guardian.relation}</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Status & Linked Info</h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Account</p>
                <StatusBadge variant={guardian.isActive ? 'success' : 'neutral'} label={guardian.isActive ? 'Active' : 'Inactive'} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Emergency</p>
                <StatusBadge variant={guardian.isEmergencyContact ? 'danger' : 'neutral'} label={guardian.isEmergencyContact ? 'Emergency' : 'Standard'} />
              </div>
            </div>
            {guardian.tenant && (
              <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Linked Tenant</p>
                <p className="text-sm font-bold text-[color:var(--color-text-primary)]">{guardian.tenant.user?.name ?? 'N/A'}</p>
                {guardian.tenant.room && <p className="mt-0.5 text-[12px] font-medium text-[color:var(--color-text-muted)]">Room {guardian.tenant.room.roomNumber}</p>}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {guardian.notes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 text-sm font-bold text-[color:var(--color-text-primary)]">Notes</h3>
          <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">{guardian.notes}</p>
        </motion.div>
      )}

      <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
        Created {formatDateTime(guardian.createdAt)} · Updated {formatDateTime(guardian.updatedAt)}
      </p>
    </motion.div>
  );
}
