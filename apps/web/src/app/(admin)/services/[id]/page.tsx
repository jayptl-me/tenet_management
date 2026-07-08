'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Wifi,
  Calendar,
  Building,
  User,
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

interface ServiceDetail {
  _id: string;
  serviceType: string;
  status: string;
  note?: string;
  floor?: { _id: string; label: string; floorNumber?: number };
  lastUpdatedBy?: { name: string };
  lastUpdatedAt?: string;
  openComplaintCount?: number;
  updatedAt: string;
}

const serviceLabels: Record<string, string> = {
  wifi: 'WiFi',
  electricity: 'Electricity',
  water_supply: 'Water Supply',
  washing_machine_1: 'Washing Machine 1',
  washing_machine_2: 'Washing Machine 2',
  fridge: 'Fridge',
  geyser: 'Geyser',
};

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`services/${id}`)
      .json<{ success: boolean; data: ServiceDetail }>()
      .then((res) => setService(res.data))
      .catch(() => setError('Failed to load service details'))
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
  if (error || !service) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Service not found'}</p>
        </div>
      </div>
    );
  }

  const statusVariant = statusToVariant(service.status);
  const label = serviceLabels[service.serviceType] ?? service.serviceType;
  const floorLabel = service.floor?.label ?? 'N/A';
  const openCount = service.openComplaintCount ?? 0;

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">{label}</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              {floorLabel}{service.floor?.floorNumber != null ? ` (Floor #${service.floor.floorNumber})` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={statusVariant} label={service.status.replace(/_/g, ' ')} />
          <Button variant="outline" size="icon" onClick={() => router.push(`/services/${service._id}/edit`)} title="Edit service">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Floor"
          value={floorLabel}
          icon={<Building className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Status"
          value={service.status.replace(/_/g, ' ')}
          icon={<Wifi className="h-4 w-4" />}
          variant={statusVariant === 'success' ? 'success' : statusVariant === 'warning' ? 'warning' : 'danger'}
        />
        <StatCard
          title="Open Complaints"
          value={openCount.toString()}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={openCount > 0 ? 'danger' : 'success'}
        />
      </motion.div>

      {/* ── Info Cards ──────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Wifi className="h-5 w-5 text-[color:var(--color-brand-500)]" />Service Information
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Type</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{label}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <div className="mt-1"><StatusBadge variant={statusVariant} label={service.status.replace(/_/g, ' ')} /></div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Floor</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Building className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{floorLabel}{service.floor?.floorNumber != null ? ` #${service.floor.floorNumber}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Last Updated</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDateTime(service.lastUpdatedAt || service.updatedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <User className="h-5 w-5 text-[color:var(--color-brand-500)]" />Last Updated By
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="text-lg font-extrabold text-[color:var(--color-text-primary)]">{service.lastUpdatedBy?.name ?? 'System'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Timestamp</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{formatDateTime(service.lastUpdatedAt || service.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Open Complaints Warning ─────────────── */}
      {openCount > 0 && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[color:var(--color-danger-800)]">
            <AlertTriangle className="h-5 w-5" />
            {openCount} Open Complaint{openCount > 1 ? 's' : ''}
          </h3>
          <p className="text-[13px] font-semibold text-[color:var(--color-danger-600)]">
            There {openCount === 1 ? 'is' : 'are'} currently {openCount} unresolved complaint{openCount > 1 ? 's' : ''} related to this service on this floor.
          </p>
        </motion.div>
      )}

      {/* ── Notes ───────────────────────────────── */}
      {service.note && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[color:var(--color-warning-800)]">Notes</h3>
          <p className="whitespace-pre-wrap text-sm font-medium text-[color:var(--color-warning-900)]">{service.note}</p>
        </motion.div>
      )}

      {/* ── Actions ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => router.push(`/services/${service._id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit Service
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
