'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileDown,
  MessageCircle,
  CreditCard,
  ReceiptText,
  IndianRupee,
  Calendar,
  User,
  Building,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { DonutChart } from '@/components/ui/DonutChart';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

interface LineItem {
  description: string;
  amount: number;
}

interface PaymentRecord {
  _id: string;
  amount: number;
  method: string;
  status: string;
  paidAt?: string;
  utrNumber?: string;
}

interface UserInfo {
  name: string;
  email?: string;
  phone?: string;
}

interface TenantInfo {
  _id: string;
  userId?: UserInfo;
  roomId?: {
    _id: string;
    roomNumber: string;
    floor?: { _id: string; name: string };
  };
}

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  tenantId?: TenantInfo;
  month: string;
  lineItems: LineItem[];
  rentAmount: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  payments?: PaymentRecord[];
  whatsAppUrl?: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

function formatDate(dateStr: string | undefined): string {
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

function formatMonth(month: string): string {
  try {
    const [y, m] = month.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch {
    return month;
  }
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchInvoice() {
      setIsLoading(true);
      setError('');
      try {
        const res = await api
          .get(`invoices/${params.id}`)
          .json<{ success: boolean; data: InvoiceDetail }>();
        setInvoice(res.data);
      } catch {
        setError('Failed to load invoice details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvoice();
  }, [params.id]);

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Invoice not found'}</p>
        </div>
      </div>
    );
  }

  const tenantName = invoice.tenantId?.userId?.name ?? 'N/A';
  const roomNumber = invoice.tenantId?.roomId?.roomNumber ?? 'N/A';
  const floorName = invoice.tenantId?.roomId?.floor?.name ?? 'N/A';
  const tenantPhone = invoice.tenantId?.userId?.phone;
  const statusLabel = invoice.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const statusVariant = statusToVariant(invoice.status);

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-5xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              {invoice.invoiceNumber}
            </h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              {formatMonth(invoice.month)} · Created {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge variant={statusVariant} label={statusLabel} />
      </motion.div>

      {/* ── Summary Stats Grid ─────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Amount" value={formatCurrency(invoice.totalAmount)} icon={<ReceiptText className="h-4 w-4" />} variant="default" />
        <StatCard title="Paid" value={formatCurrency(invoice.paidAmount)} icon={<CreditCard className="h-4 w-4" />} variant="success" />
        <StatCard title="Balance" value={formatCurrency(invoice.balance)} icon={<IndianRupee className="h-4 w-4" />} variant={invoice.balance > 0 ? 'danger' : 'success'} />
        <StatCard title="Due Date" value={formatDate(invoice.dueDate)} icon={<Calendar className="h-4 w-4" />} variant="default" />
      </motion.div>

      {/* ── Payment Progress (DonutChart) ───────── */}
      {invoice.totalAmount > 0 && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <CreditCard className="h-5 w-5 text-[color:var(--color-success-500)]" />
            Payment Progress
          </h3>
          <div className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-8">
            <DonutChart
              segments={[
                { value: invoice.paidAmount, color: 'var(--color-success-400)', label: 'Paid' },
                { value: invoice.balance, color: 'var(--color-danger-400)', label: 'Balance' },
              ]}
              centerLabel={`${Math.round((invoice.paidAmount / invoice.totalAmount) * 100)}%`}
              sublabel="Paid"
              size={160}
              thickness={28}
            />
            <div className="mt-4 sm:mt-0 sm:self-center">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[color:var(--color-success-400)]" />
                  <span className="font-semibold text-[color:var(--color-text-primary)]">
                    Paid: {formatCurrency(invoice.paidAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[color:var(--color-danger-400)]" />
                  <span className="font-semibold text-[color:var(--color-text-primary)]">
                    Balance: {formatCurrency(invoice.balance)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[color:var(--color-surface-300)]" />
                  <span className="font-semibold text-[color:var(--color-text-primary)]">
                    Total: {formatCurrency(invoice.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Details Grid ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Breakdown & Line Items */}
        <div className="space-y-6 lg:col-span-3">
          {/* Rent Breakdown */}
          <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
              <IndianRupee className="h-5 w-5 text-[color:var(--color-brand-500)]" />
              Breakdown
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-4 shadow-[var(--shadow-sm)]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand-600)]">Rent</p>
                <p className="mt-1 text-xl font-bold text-[color:var(--color-brand-900)]">{formatCurrency(invoice.rentAmount)}</p>
              </div>
              <div className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-4 shadow-[var(--shadow-sm)]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-warning-600)]">Electricity</p>
                <p className="mt-1 text-xl font-bold text-[color:var(--color-warning-900)]">{formatCurrency(invoice.electricityAmount)}</p>
              </div>
              <div className="rounded-xl border border-[color:var(--color-surface-300)] bg-[color:var(--color-surface-50)] p-4 shadow-[var(--shadow-sm)]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Other</p>
                <p className="mt-1 text-xl font-bold text-[color:var(--color-text-primary)]">{formatCurrency(invoice.otherCharges)}</p>
              </div>
            </div>
          </motion.div>

          {/* Line Items */}
          {invoice.lineItems && invoice.lineItems.length > 0 && (
            <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
              <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Line Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border-color)]">
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Description</th>
                      <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-color)]">
                    {invoice.lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-semibold text-[color:var(--color-text-primary)]">{item.description}</td>
                        <td className="py-3 text-right font-bold text-[color:var(--color-text-primary)]">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[color:var(--border-color)]">
                      <td className="pt-3 text-right text-base font-bold uppercase text-[color:var(--color-text-primary)]">Total</td>
                      <td className="pt-3 text-right text-base font-bold text-[color:var(--color-text-primary)]">{formatCurrency(invoice.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>
          )}

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
                <CreditCard className="h-5 w-5 text-[color:var(--color-success-500)]" />
                Payment History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border-color)]">
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Amount</th>
                      <th className="pb-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Method</th>
                      <th className="hidden pb-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)] sm:table-cell">UTR</th>
                      <th className="hidden pb-3 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)] sm:table-cell">Date</th>
                      <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border-color)]">
                    {invoice.payments.map((p) => (
                      <tr key={p._id}>
                        <td className="py-3 font-bold text-[color:var(--color-text-primary)]">{formatCurrency(p.amount)}</td>
                        <td className="py-3 capitalize text-[color:var(--color-text-secondary)]">{p.method.replace('_', ' ')}</td>
                        <td className="hidden py-3 font-mono text-xs text-[color:var(--color-text-secondary)] sm:table-cell">{p.utrNumber ?? '—'}</td>
                        <td className="hidden py-3 text-[color:var(--color-text-secondary)] sm:table-cell">{formatDate(p.paidAt)}</td>
                        <td className="py-3 text-right">
                          <span className={`inline-block rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-bold capitalize ${p.status === 'paid' ? 'border-[color:var(--color-success-200)] bg-[color:var(--color-success-100)] text-[color:var(--color-success-700)]' : 'border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]'}`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ── Payment Timeline ──────────────────── */}
          {invoice.payments && invoice.payments.length > 0 && (
            <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
                <CreditCard className="h-5 w-5 text-[color:var(--color-brand-500)]" />
                Payment Timeline
              </h3>
              <Timeline
                events={invoice.payments.map((p) => ({
                  id: p._id,
                  date: p.paidAt ?? invoice.createdAt,
                  title: `${formatCurrency(p.amount)} via ${p.method.replace(/_/g, ' ')}`,
                  description: p.utrNumber ? `UTR: ${p.utrNumber}` : undefined,
                  status: (p.status === 'paid' ? 'success' : 'warning') as 'success' | 'warning',
                }))}
              />
            </motion.div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-5 shadow-[var(--shadow-card)]">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-warning-600)]">Notes</p>
              <p className="font-semibold text-[color:var(--color-warning-900)]">{invoice.notes}</p>
            </motion.div>
          )}
        </div>

        {/* Right: Tenant Info + Actions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Tenant Card */}
          <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
              <User className="h-5 w-5 text-[color:var(--color-brand-500)]" />
              Tenant
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Name</p>
                <p className="mt-0.5 text-lg font-bold text-[color:var(--color-text-primary)]">{tenantName}</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    <Building className="h-3 w-3" /> Room
                  </p>
                  <p className="mt-0.5 font-bold text-[color:var(--color-text-primary)]">{roomNumber}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Floor</p>
                  <p className="mt-0.5 font-bold text-[color:var(--color-text-primary)]">{floorName}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Actions Card */}
          <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
            <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                onClick={() => window.open(`${API_BASE_URL}/invoices/${invoice._id}/pdf`, '_blank')}
              >
                <FileDown className="h-4 w-4" />
                Download PDF
              </Button>
              {tenantPhone && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const text = [
                      `Invoice ${invoice.invoiceNumber}`,
                      `Amount: ${formatCurrency(invoice.totalAmount)}`,
                      `Balance: ${formatCurrency(invoice.balance)}`,
                      `Download: ${API_BASE_URL}/invoices/${invoice._id}/pdf`,
                    ].join('\n');
                    window.open(generateWhatsAppUrl(tenantPhone, text), '_blank', 'noopener,noreferrer');
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Share via WhatsApp
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => router.push(`/invoices/${invoice._id}/edit`)}
              >
                Edit Invoice
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Last Updated ────────────────────────── */}
      {invoice.updatedAt && (
        <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
          Last updated: {new Date(invoice.updatedAt).toLocaleString('en-IN')}
        </p>
      )}
    </motion.div>
  );
}