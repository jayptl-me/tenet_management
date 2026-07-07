'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  User,
  Home,
  Calendar,
  FileText,
  Receipt,
  CheckCircle,
  XCircle,
  MessageCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface PaymentDetail {
  _id: string;
  tenant?: { _id: string; user?: { name: string; phone?: string }; room?: { _id: string; roomNumber: string } };
  amount: number;
  method: string;
  type: string;
  status: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  invoiceId?: string;
  invoiceNumber?: string;
  screenshotUrl?: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return '₹' + amount.toLocaleString('en-IN');
  } catch {
    return '₹' + amount;
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatMethod(method: string) {
  return method.replace(/_/g, ' ');
}

function formatType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`payments/${id}`)
      .json<{ success: boolean; data: PaymentDetail }>()
      .then((res) => {
        setPayment(res.data);
      })
      .catch(() => {
        setError('Failed to load payment details');
      })
      .finally(() => {
        setIsLoading(false);
      });
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
  if (error || !payment) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Payment not found'}</p>
        </div>
      </div>
    );
  }

  const formattedDate = payment.paidAt || payment.createdAt;
  const statusVariant = statusToVariant(payment.status);

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="space-y-6 pb-8">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Payment Details
            </h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">Transaction ID: {payment._id}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusVariant}
          label={payment.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        />
      </motion.div>

      {/* ── Amount Highlight ────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="mb-1 text-sm font-bold uppercase tracking-wide text-[color:var(--color-text-muted)]">Amount</p>
        <p className="text-4xl font-bold text-[color:var(--color-text-primary)]">{formatCurrency(payment.amount)}</p>
        {payment.type && (
          <p className="mt-1 text-sm font-semibold capitalize text-[color:var(--color-text-secondary)]">
            {formatType(payment.type)}
          </p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Payment Information ──────────────── */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <CreditCard className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
            Payment Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Method</p>
              <p className="mt-0.5 text-sm font-semibold capitalize text-[color:var(--color-text-primary)]">
                {formatMethod(payment.method)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Category</p>
              <p className="mt-0.5 text-sm font-semibold text-[color:var(--color-text-primary)]">
                {formatType(payment.type)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
              <div className="mt-1">
                <StatusBadge variant={statusVariant} label={payment.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Transaction Date</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                {formatDate(formattedDate)}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Tenant Information ────────────────── */}
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <User className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
            Tenant Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
              <p className="mt-0.5 text-sm font-semibold text-[color:var(--color-text-primary)]">
                {payment.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
                <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                {payment.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Created</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                {formatDateTime(payment.createdAt)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Invoice Reference ───────────────────── */}
      {(payment.invoiceId || payment.invoiceNumber) && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Receipt className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
            Invoice Reference
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {payment.invoiceNumber && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Invoice Number</p>
                <p className="mt-0.5 text-sm font-semibold text-[color:var(--color-text-primary)]">{payment.invoiceNumber}</p>
              </div>
            )}
            {payment.invoiceId && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Invoice ID</p>
                <p className="mt-0.5 break-all font-mono text-xs text-[color:var(--color-text-secondary)]">{payment.invoiceId}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Notes ──────────────────────────────── */}
      {payment.notes && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <FileText className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
            Notes
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">{payment.notes}</p>
        </motion.div>
      )}

      {/* ── Screenshot ─────────────────────────── */}
      {payment.screenshotUrl && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <FileText className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
            Payment Screenshot
          </h3>
          <a
            href={payment.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-sm overflow-hidden rounded-xl border border-[color:var(--border-color)] shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)]"
          >
            <img
              src={payment.screenshotUrl}
              alt="Payment Screenshot"
              className="w-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.classList.add('flex', 'items-center', 'justify-center', 'p-10');
                  parent.innerHTML =
                    '<span class="text-[color:var(--color-text-muted)] flex flex-col items-center gap-2 text-sm font-semibold"><svg class="h-10 w-10" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Image unavailable</span></span>';
                }
              }}
            />
          </a>
        </motion.div>
      )}

      {/* ── Actions ────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {payment.status === 'pending_verification' && (
            <>
              <Button
                variant="primary"
                disabled={actionLoading === 'approve'}
                loading={actionLoading === 'approve'}
                onClick={async () => {
                  setActionLoading('approve');
                  try {
                    await api.post(`payments/${payment._id}/verify`, { json: { approved: true } }).json();
                    window.location.reload();
                  } catch {
                    alert('Failed to verify payment');
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                <CheckCircle className="h-4 w-4" />
                Approve Payment
              </Button>
              <Button
                variant="danger"
                disabled={actionLoading === 'reject'}
                loading={actionLoading === 'reject'}
                onClick={async () => {
                  setActionLoading('reject');
                  try {
                    await api.post(`payments/${payment._id}/verify`, { json: { approved: false } }).json();
                    window.location.reload();
                  } catch {
                    alert('Failed to reject payment');
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                <XCircle className="h-4 w-4" />
                Reject Payment
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => {
              const phone = payment.tenant?.user?.phone ?? '';
              const text = `Payment of ${formatCurrency(payment.amount)} received. Status: ${payment.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;
              const url = generateWhatsAppUrl(phone, text);
              if (phone) window.open(url, '_blank', 'noopener,noreferrer');
            }}
            disabled={!payment.tenant?.user?.phone}
          >
            <MessageCircle className="h-4 w-4" />
            Share via WhatsApp
          </Button>
        </div>
      </motion.div>

      {/* ── Footer Meta ────────────────────────── */}
      <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
        Last updated: {formatDateTime(payment.paidAt || payment.createdAt)}
      </p>
    </motion.div>
  );
}