'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  UserPlus,
  Phone,
  Mail,
  Tag,
  FileText,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

const enquiryUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'lost']),
});

type EnquiryUpdateForm = z.infer<typeof enquiryUpdateSchema>;

interface EnquiryDetail {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  status: string;
  source: string;
  followUpDate?: string;
  referralDetails?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

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

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN');
  } catch {
    return '—';
  }
}

export default function EnquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [enquiry, setEnquiry] = useState<EnquiryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EnquiryUpdateForm>({
    resolver: zodResolver(enquiryUpdateSchema),
    defaultValues: { status: 'new' },
  });

  useEffect(() => {
    async function fetchEnquiry() {
      setIsLoading(true);
      setError('');
      try {
        const res = await api
          .get(`enquiries/${params.id}`)
          .json<{ success: boolean; data: EnquiryDetail }>();
        setEnquiry(res.data);
        reset({ status: (res.data.status as EnquiryUpdateForm['status']) ?? 'new' });
      } catch {
        setError('Failed to load enquiry details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchEnquiry();
  }, [params.id, reset]);

  const onSubmit = async (data: EnquiryUpdateForm) => {
    setIsSaving(true);
    try {
      const res = await api
        .put(`enquiries/${params.id}/status`, { json: data })
        .json<{ success: boolean }>();
      if (res.success) {
        toast.success('Enquiry updated successfully');
        setEnquiry((prev) => (prev ? { ...prev, status: data.status } : prev));
      } else {
        toast.error('Failed to update enquiry');
      }
    } catch {
      toast.error('Failed to update enquiry');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !enquiry) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Enquiry not found'}</p>
        </div>
      </div>
    );
  }

  const statusVariant = statusToVariant(enquiry.status);

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">Enquiry from {enquiry.name}</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Received {formatDate(enquiry.createdAt)} · {enquiry.source}
            </p>
          </div>
        </div>
        <StatusBadge variant={statusVariant} label={enquiry.status.replace(/_/g, ' ')} />
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Phone"
          value={enquiry.phone}
          icon={<Phone className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Source"
          value={enquiry.source.replace(/_/g, ' ')}
          icon={<Tag className="h-4 w-4" />}
          variant="brand"
        />
        <StatCard
          title="Status"
          value={enquiry.status.replace(/_/g, ' ')}
          icon={<FileText className="h-4 w-4" />}
          variant={statusVariant === 'success' ? 'success' : statusVariant === 'warning' ? 'warning' : 'default'}
        />
      </motion.div>

      {/* ── Info Cards ──────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <FileText className="h-5 w-5 text-[color:var(--color-brand-500)]" />Enquiry Details
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="mt-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">{enquiry.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Phone</p>
              <p className="mt-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">{enquiry.phone}</p>
            </div>
            {enquiry.email && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Email</p>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-[color:var(--color-text-secondary)]">
                  <Mail className="h-3 w-3 text-[color:var(--color-text-muted)]" />{enquiry.email}
                </p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Source</p>
              <p className="mt-1 text-[13px] font-semibold capitalize text-[color:var(--color-text-primary)]">{enquiry.source}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <div className="mt-1"><StatusBadge variant={statusVariant} label={enquiry.status.replace(/_/g, ' ')} /></div>
            </div>
            {enquiry.followUpDate && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Follow-up Date</p>
                <p className="mt-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">{formatDate(enquiry.followUpDate)}</p>
              </div>
            )}
          </div>

          {enquiry.message && (
            <div className="mt-5 border-t border-[color:var(--color-surface-200)] pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Message</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">{enquiry.message}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Tag className="h-5 w-5 text-[color:var(--color-brand-500)]" />Source & Info
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Source</p>
              <p className="text-[13px] font-semibold capitalize text-[color:var(--color-text-primary)]">{enquiry.source}</p>
            </div>
            {enquiry.referralDetails && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Referral</p>
                <p className="text-[13px] text-[color:var(--color-text-secondary)]">{enquiry.referralDetails}</p>
              </div>
            )}
            {enquiry.notes && (
              <div className="border-t border-[color:var(--color-surface-200)] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--color-text-secondary)]">{enquiry.notes}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Status Update Form ──────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Update Status</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-end gap-4 sm:flex-row">
          <div className="w-full flex-1 sm:max-w-xs">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              error={errors.status?.message}
              {...register('status')}
            />
          </div>
          <Button type="submit" disabled={isSaving} loading={isSaving}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </form>
      </motion.div>

      {/* ── Actions ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
        <p className="mb-4 text-sm text-[color:var(--color-text-secondary)]">
          Convert this enquiry into a tenant. This will pre-fill the new tenant form with the enquirer's details.
        </p>
        <Button
          variant="primary"
          onClick={() =>
            router.push(
              `/tenants/new?name=${encodeURIComponent(enquiry.name)}&phone=${encodeURIComponent(enquiry.phone)}&email=${encodeURIComponent(enquiry.email || '')}&source=enquiry&enquiryId=${enquiry._id}`,
            )
          }
        >
          <UserPlus className="h-4 w-4" />
          Convert to Tenant
        </Button>
      </motion.div>

      {/* ── Meta ────────────────────────────────── */}
      {enquiry.updatedAt && (
        <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
          Last updated: {formatDateTime(enquiry.updatedAt)}
        </p>
      )}
    </motion.div>
  );
}
