'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CreditCard,
  User,
  Home,
  Calendar,
  FileText,
  Receipt,
  CheckCircle,
  XCircle,
  MessageCircle,
  History,
  Hash,
  Download,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { modalContent } from '@/lib/animations';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { generateWhatsAppUrl } from '@/lib/whatsapp';

interface PaymentDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { name: string; phone?: string };
    room?: { _id: string; roomNumber: string };
  };
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
  utrNumber?: string;
}

interface ReceiptData {
  _id: string;
  amount: number;
  method?: string;
  type?: string;
  status?: string;
  notes?: string;
  paidAt?: string;
  createdAt?: string;
  utrNumber?: string;
  invoiceId?:
    | string
    | {
        _id?: string;
        invoiceNumber?: string;
        month?: string;
        totalAmount?: number;
      };
  tenantId?: {
    _id?: string;
    userId?: { name?: string; phone?: string; email?: string };
    roomId?: { roomNumber?: string };
  };
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

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function receiptInvoiceNumber(receipt: ReceiptData): string {
  if (!receipt.invoiceId) return 'N/A';
  if (typeof receipt.invoiceId === 'string') return receipt.invoiceId;
  return receipt.invoiceId.invoiceNumber ?? receipt.invoiceId._id ?? 'N/A';
}

function receiptTenantName(receipt: ReceiptData): string {
  return receipt.tenantId?.userId?.name ?? 'N/A';
}

function receiptRoomNumber(receipt: ReceiptData): string {
  return receipt.tenantId?.roomId?.roomNumber ?? 'N/A';
}

export default function PaymentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);

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

  const loadReceipt = async () => {
    if (!payment) return;
    setReceiptLoading(true);
    setReceiptError('');
    try {
      const res = await api.get(`payments/${payment._id}/receipt`).json<{
        success: boolean;
        data: ReceiptData;
      }>();
      setReceipt(res.data);
      setReceiptOpen(true);
    } catch {
      setReceiptError('Failed to load receipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  if (!isLoading && (error || !payment)) {
    return (
      <FormPage
        title="Payment Details"
        description="View payment information"
        backHref="/payments"
        error={error || 'Payment not found'}
        maxWidth="4xl"
      />
    );
  }

  const formattedDate = payment?.paidAt || payment?.createdAt;
  const statusVariant = payment ? statusToVariant(payment.status) : 'neutral';
  const canShowReceipt =
    payment &&
    (payment.status === 'paid' ||
      payment.status === 'approved' ||
      payment.status === 'completed' ||
      payment.status === 'pending_verification');

  return (
    <FormPage
      title="Payment Details"
      description={payment ? `Transaction ID: ${payment._id}` : undefined}
      backHref="/payments"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        payment ? (
          <StatusBadge variant={statusVariant} label={formatStatusLabel(payment.status)} />
        ) : undefined
      }
    >
      {payment && (
        <div className="space-y-6">
          <DetailCard title="Amount" icon={<CreditCard />}>
            <div className="text-center">
              <p className="text-4xl font-bold text-[color:var(--color-text-primary)]">
                {formatCurrency(payment.amount)}
              </p>
              {payment.type && (
                <p className="mt-1 text-sm font-semibold capitalize text-[color:var(--color-text-secondary)]">
                  {formatType(payment.type)}
                </p>
              )}
            </div>
          </DetailCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Amount"
              value={formatCurrency(payment.amount)}
              icon={<CreditCard className="h-4 w-4" />}
              variant={
                payment.status === 'paid' ||
                payment.status === 'approved' ||
                payment.status === 'completed'
                  ? 'success'
                  : 'default'
              }
            />
            <StatCard
              title="Method"
              value={formatMethod(payment.method)}
              icon={<Receipt className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Status"
              value={formatStatusLabel(payment.status)}
              icon={<CheckCircle className="h-4 w-4" />}
              variant={
                payment.status === 'paid' ||
                payment.status === 'approved' ||
                payment.status === 'completed'
                  ? 'success'
                  : statusVariant === 'danger'
                    ? 'danger'
                    : 'warning'
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard title="Payment Information" icon={<CreditCard />}>
              <DetailList>
                <DetailRow
                  label="Method"
                  value={<span className="capitalize">{formatMethod(payment.method)}</span>}
                />
                <DetailRow label="Category" value={formatType(payment.type)} />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusVariant}
                      label={formatStatusLabel(payment.status)}
                    />
                  }
                />
                {payment.utrNumber && (
                  <DetailRow
                    label="UTR Number"
                    value={
                      <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold tracking-wide text-[color:var(--color-text-primary)]">
                        <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                        {payment.utrNumber}
                      </span>
                    }
                  />
                )}
                <DetailRow
                  label="Transaction Date"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDate(formattedDate)}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Tenant Information" icon={<User />}>
              <DetailList>
                <DetailRow label="Name" value={payment.tenant?.user?.name ?? 'N/A'} />
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {payment.tenant?.room?.roomNumber ?? 'N/A'}
                    </span>
                  }
                />
                <DetailRow
                  label="Created"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDateTime(payment.createdAt)}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>
          </div>

          {(payment.invoiceId || payment.invoiceNumber) && (
            <DetailCard title="Invoice Reference" icon={<Receipt />}>
              <DetailList>
                {payment.invoiceNumber && (
                  <DetailRow
                    label="Invoice Number"
                    value={
                      payment.invoiceId ? (
                        <Link
                          href={`/invoices/${payment.invoiceId}`}
                          className="font-semibold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                        >
                          {payment.invoiceNumber}
                        </Link>
                      ) : (
                        payment.invoiceNumber
                      )
                    }
                  />
                )}
                {payment.invoiceId && (
                  <DetailRow
                    label="Invoice ID"
                    value={
                      <Link
                        href={`/invoices/${payment.invoiceId}`}
                        className="break-all font-mono text-xs text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                      >
                        {payment.invoiceId}
                      </Link>
                    }
                  />
                )}
              </DetailList>
            </DetailCard>
          )}

          {payment.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                {payment.notes}
              </p>
            </DetailCard>
          )}

          {payment.screenshotUrl && (
            <DetailCard title="Payment Screenshot" icon={<FileText />}>
              <a
                href={payment.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-color)] shadow-[var(--shadow-sm)] transition-all duration-[var(--transition-duration)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
            </DetailCard>
          )}

          <DetailCard title="Actions" icon={<CheckCircle />}>
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
                        await api
                          .post(`payments/${payment._id}/verify`, {
                            json: { approved: true },
                          })
                          .json();
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
                        await api
                          .post(`payments/${payment._id}/verify`, {
                            json: { approved: false },
                          })
                          .json();
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
              {canShowReceipt && (
                <Button
                  variant="outline"
                  loading={receiptLoading}
                  disabled={receiptLoading}
                  onClick={() => void loadReceipt()}
                >
                  <Receipt className="h-4 w-4" />
                  View receipt
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  const phone = payment.tenant?.user?.phone ?? '';
                  const text = `Payment of ${formatCurrency(payment.amount)} received. Status: ${formatStatusLabel(payment.status)}`;
                  const url = generateWhatsAppUrl(phone, text);
                  if (phone) window.open(url, '_blank', 'noopener,noreferrer');
                }}
                disabled={!payment.tenant?.user?.phone}
              >
                <MessageCircle className="h-4 w-4" />
                Share via WhatsApp
              </Button>
            </div>
            {receiptError && (
              <p className="mt-3 text-sm font-semibold text-[color:var(--color-danger-600)]">
                {receiptError}
              </p>
            )}
          </DetailCard>

          <DetailCard title="Recent Activity" icon={<History />}>
            {payment.createdAt ? (
              <Timeline
                events={[
                  {
                    id: `${payment._id}-created`,
                    date: payment.createdAt,
                    title: 'Payment Recorded',
                    description: `${formatCurrency(payment.amount)} via ${formatMethod(payment.method)}`,
                    status: 'info',
                  },
                  {
                    id: `${payment._id}-status`,
                    date: payment.paidAt ?? payment.createdAt,
                    title: `Status: ${formatStatusLabel(payment.status)}`,
                    description: payment.notes ?? undefined,
                    status: (payment.status === 'paid' ||
                    payment.status === 'approved' ||
                    payment.status === 'completed'
                      ? 'success'
                      : payment.status === 'rejected' || payment.status === 'cancelled'
                        ? 'danger'
                        : 'warning') as 'success' | 'warning' | 'danger',
                  },
                ]}
              />
            ) : (
              <p className="text-center text-sm font-semibold text-[color:var(--color-text-muted)]">
                No activity recorded yet.
              </p>
            )}
          </DetailCard>

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            Last updated: {formatDateTime(payment.paidAt || payment.createdAt)}
          </p>
        </div>
      )}

      <AnimatePresence>
        {receiptOpen && receipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center print:static print:block">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/50 backdrop-blur-sm print:hidden"
              onClick={() => setReceiptOpen(false)}
            />
            <motion.div
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="relative z-10 mx-4 w-full max-w-lg rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)] print:max-w-none print:border-0 print:shadow-none"
            >
              <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
                <div>
                  <h3 className="text-[15px] font-bold text-[color:var(--color-text-primary)]">
                    Payment Receipt
                  </h3>
                  <p className="text-xs font-semibold text-[color:var(--color-text-muted)]">
                    Reference {receipt._id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptOpen(false)}
                  className="rounded-[var(--radius-md)] p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-100)]"
                  aria-label="Close receipt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-[color:var(--border-color)] pb-2">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Amount</span>
                  <span className="font-bold text-[color:var(--color-text-primary)]">
                    {formatCurrency(receipt.amount)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Status</span>
                  <span className="capitalize text-[color:var(--color-text-primary)]">
                    {formatStatusLabel(receipt.status ?? 'N/A')}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Method</span>
                  <span className="capitalize text-[color:var(--color-text-primary)]">
                    {receipt.method ? formatMethod(receipt.method) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Type</span>
                  <span className="capitalize text-[color:var(--color-text-primary)]">
                    {receipt.type ? formatType(receipt.type) : 'N/A'}
                  </span>
                </div>
                {receipt.utrNumber && (
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-[color:var(--color-text-muted)]">UTR</span>
                    <span className="font-mono font-bold text-[color:var(--color-text-primary)]">
                      {receipt.utrNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Tenant</span>
                  <span className="text-[color:var(--color-text-primary)]">
                    {receiptTenantName(receipt)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Room</span>
                  <span className="text-[color:var(--color-text-primary)]">
                    {receiptRoomNumber(receipt)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Invoice</span>
                  <span className="text-[color:var(--color-text-primary)]">
                    {receiptInvoiceNumber(receipt)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-[color:var(--color-text-muted)]">Paid at</span>
                  <span className="text-[color:var(--color-text-primary)]">
                    {formatDateTime(receipt.paidAt ?? receipt.createdAt)}
                  </span>
                </div>
                {receipt.notes && (
                  <div className="border-t border-[color:var(--border-color)] pt-2">
                    <p className="font-semibold text-[color:var(--color-text-muted)]">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
                      {receipt.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2 print:hidden">
                <Button variant="outline" onClick={() => setReceiptOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" onClick={printReceipt}>
                  <Download className="h-4 w-4" />
                  Print / Download
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FormPage>
  );
}
