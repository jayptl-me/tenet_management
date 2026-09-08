'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CreditCard,
  User,
  Home,
  Calendar,
  FileText,
  Receipt,
  CheckCircle2,
  XCircle,
  MessageCircle,
  History,
  Hash,
  Pencil,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { Modal } from '@/components/ui/Modal';
import { ReceiptDocument } from '@/components/admin/ReceiptDocument';
import { VerifyPaymentModal, type VerifyPaymentTarget } from '@/components/admin/VerifyPaymentModal';
import { KpiHeader } from '@/components/ui/KpiHeader';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { clsx } from 'clsx';

interface PaymentDetail {
  _id: string;
  tenant?: {
    _id: string;
    bedId?: string | null;
    user?: { name: string; phone?: string };
    room?: { _id: string; roomNumber: string; floor?: { label?: string } | null };
  };
  amount: number;
  method: string;
  type: string;
  status: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  dueDate?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  screenshotUrl?: string;
  utrNumber?: string;
  verifiedBy?: { name?: string } | string;
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

interface AuditEvent {
  id: string;
  action: string;
  userId?: { name?: string } | string;
  timestamp: string;
  details?: Record<string, unknown>;
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

function auditTitle(event: AuditEvent): string {
  switch (event.action) {
    case 'payment_verify':
      return event.details?.approved === true || event.details?.status === 'paid'
        ? 'Payment verified'
        : event.details?.source === 'offline'
          ? 'Offline payment recorded'
          : 'Verification updated';
    case 'update':
      return 'Payment updated';
    case 'delete':
      return 'Payment deleted';
    case 'create':
      return 'Payment created';
    default:
      return formatStatusLabel(event.action);
  }
}

function auditDescription(event: AuditEvent): string | undefined {
  const d = event.details;
  if (!d) return undefined;
  const parts: string[] = [];
  if (typeof d.amount === 'number') parts.push(formatCurrency(d.amount));
  if (typeof d.method === 'string') parts.push(String(d.method).replace(/_/g, ' '));
  if (typeof d.status === 'string') parts.push(String(d.status).replace(/_/g, ' '));
  if (typeof d.approved === 'boolean') parts.push(d.approved ? 'approved' : 'rejected');
  if (typeof d.notes === 'string' && d.notes) parts.push(`"${d.notes}"`);
  if (d.source) parts.push(`via ${String(d.source)}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [copiedUtr, setCopiedUtr] = useState(false);

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
      .catch(async (err) => {
        setError((await parseApiError(err)).message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  // Real activity trail from audit logs (falls back silently)
  useEffect(() => {
    if (!id) return;
    setEventsLoading(true);
    api
      .get(`audit-logs?resource=payment&resourceId=${id}&limit=25`)
      .json<{ success: boolean; data: AuditEvent[] }>()
      .then((res) => {
        setEvents(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, [id]);

  const loadReceipt = async () => {
    if (!payment) return;
    setReceiptLoading(true);
    try {
      const res = await api.get(`payments/${payment._id}/receipt`).json<{
        success: boolean;
        data: ReceiptData;
      }>();
      setReceipt(res.data);
      setReceiptOpen(true);
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setReceiptLoading(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const copyUtr = async () => {
    if (!payment?.utrNumber) return;
    try {
      await navigator.clipboard.writeText(payment.utrNumber);
      setCopiedUtr(true);
      window.setTimeout(() => setCopiedUtr(false), 1500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleVerify = async (approved: boolean, notes: string) => {
    if (!payment) return;
    setVerifying(true);
    try {
      await api
        .post(`payments/${payment._id}/verify`, { json: { approved, notes: notes || undefined } })
        .json();
      toast.success(approved ? 'Payment approved' : 'Payment rejected');
      setVerifyOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error((await parseApiError(err)).message);
      setVerifying(false);
    }
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
  const isPaid =
    payment &&
    (payment.status === 'paid' ||
      payment.status === 'approved' ||
      payment.status === 'completed');
  const canShowReceipt =
    payment &&
    (payment.status === 'paid' ||
      payment.status === 'approved' ||
      payment.status === 'completed' ||
      payment.status === 'pending_verification');

  const verifyTarget: VerifyPaymentTarget | null =
    payment
      ? {
          _id: payment._id,
          tenantName: payment.tenant?.user?.name,
          roomNumber: payment.tenant?.room?.roomNumber,
          amount: payment.amount,
          utrNumber: payment.utrNumber,
          screenshotUrl: payment.screenshotUrl,
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
          status: payment.status,
          invoiceNumber: payment.invoiceNumber,
        }
      : null;

  return (
    <FormPage
      title="Payment Details"
      description={payment ? `Transaction ID: ${payment._id}` : undefined}
      backHref="/payments"
      isLoading={isLoading}
      maxWidth="4xl"
      actions={
        payment ? (
          <Button variant="outline" onClick={() => router.push(`/payments/${payment._id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit Payment
          </Button>
        ) : undefined
      }
      badge={
        payment ? (
          <StatusBadge variant={statusVariant} label={formatStatusLabel(payment.status)} />
        ) : undefined
      }
    >
      {payment && (
        <div className="space-y-6">
          {/* Ledger KPI header */}
          <KpiHeader
            items={[
              {
                label: 'Amount',
                value: formatCurrency(payment.amount),
                sub: formatType(payment.type ?? ''),
                tone: isPaid ? 'success' : statusVariant === 'danger' ? 'danger' : 'warning',
              },
              {
                label: 'Method',
                value: formatMethod(payment.method),
                sub: payment.utrNumber ? 'UTR submitted' : 'no UTR',
                tone: 'default',
              },
              {
                label: 'Due date',
                value: formatDate(payment.dueDate),
                sub: payment.paidAt ? `paid ${formatDate(payment.paidAt)}` : 'unpaid',
                tone: 'default',
              },
              {
                label: 'Verified by',
                value:
                  typeof payment.verifiedBy === 'object' && payment.verifiedBy?.name
                    ? payment.verifiedBy.name
                    : payment.verifiedBy
                      ? 'Admin'
                      : '—',
                sub: isPaid ? 'settled' : 'not settled',
                tone: isPaid ? 'success' : 'default',
              },
            ]}
          />

          {/* UTR evidence */}
          {payment.utrNumber && (
            <div className={clsx(surfaceCardClass, 'flex flex-wrap items-center justify-between gap-3 p-4')}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]">
                  <Hash className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
                    UTR reference
                  </p>
                  <p className="font-mono text-sm font-bold tracking-wide text-[color:var(--color-brand-700)]">
                    {payment.utrNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyUtr}>
                  {copiedUtr ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedUtr ? 'Copied' : 'Copy UTR'}
                </Button>
                {payment.invoiceId && (
                  <Link
                    href={`/invoices/${payment.invoiceId}`}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-3 py-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)] transition-colors hover:bg-[color:var(--color-field-bg)]"
                  >
                    Invoice {payment.invoiceNumber}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          )}

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
                <DetailRow
                  label="Transaction Date"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDate(formattedDate)}
                    </span>
                  }
                />
                <DetailRow label="Recorded" value={formatDateTime(payment.createdAt)} />
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
                {payment.tenant?.bedId && <DetailRow label="Bed" value={payment.tenant.bedId} />}
                {payment.tenant?.room?.floor?.label && (
                  <DetailRow label="Floor" value={payment.tenant.room.floor.label} />
                )}
                {payment.tenant?.user?.phone && (
                  <DetailRow label="Phone" value={payment.tenant.user.phone} />
                )}
              </DetailList>
            </DetailCard>
          </div>

          {payment.notes && (
            <DetailCard title="Notes" icon={<FileText />}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
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

          <DetailCard title="Actions" icon={<CheckCircle2 />}>
            <div className="flex flex-wrap gap-3">
              {payment.status === 'pending_verification' && (
                <>
                  <Button variant="primary" onClick={() => setVerifyOpen(true)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Verify payment
                  </Button>
                </>
              )}
              {isPaid && (
                <Button
                  variant="danger"
                  disabled={actionLoading === 'void'}
                  loading={actionLoading === 'void'}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        'Void this paid payment? The amount returns to owed and the invoice balance is re-synced.',
                      )
                    ) {
                      return;
                    }
                    setActionLoading('void');
                    try {
                      await api.post(`payments/${payment._id}/void`, { json: {} }).json();
                      toast.success('Payment voided');
                      window.location.reload();
                    } catch (err) {
                      toast.error((await parseApiError(err)).message);
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Void payment
                </Button>
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
          </DetailCard>

          <DetailCard title="Activity" icon={<History />}>
            {eventsLoading ? (
              <p className="text-sm font-medium text-[color:var(--color-text-muted)]">
                Loading activity...
              </p>
            ) : events.length > 0 ? (
              <Timeline
                events={events.map((e) => ({
                  id: e.id,
                  date: e.timestamp,
                  title: auditTitle(e),
                  description: auditDescription(e),
                  status:
                    (e.action === 'payment_verify' &&
                      (e.details?.approved === true || e.details?.status === 'paid')) ||
                    e.action === 'create'
                      ? ('success' as const)
                      : e.action === 'delete'
                        ? ('danger' as const)
                        : ('info' as const),
                }))}
              />
            ) : (
              <div className={clsx(surfaceNestedClass, 'p-4 text-sm font-medium text-[color:var(--color-text-muted)]')}>
                No audit events recorded for this payment yet.
              </div>
            )}
          </DetailCard>

          <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
            Last updated: {formatDateTime(payment.paidAt || payment.createdAt)}
          </p>
        </div>
      )}

      {/* Receipt modal — print-isolated */}
      <Modal
        open={receiptOpen && !!receipt}
        onClose={() => setReceiptOpen(false)}
        title="Payment receipt"
        size="sm"
        loading={false}
      >
        {receipt && (
          <ReceiptDocument
            title="Payment Receipt"
            reference={`Ref ${receipt._id}`}
            statusLabel={formatStatusLabel(receipt.status ?? 'N/A')}
            amount={formatCurrency(receipt.amount)}
            lines={[
              { label: 'Tenant', value: receipt.tenantId?.userId?.name ?? 'N/A' },
              { label: 'Room', value: receipt.tenantId?.roomId?.roomNumber ?? 'N/A' },
              { label: 'Invoice', value: receiptInvoiceNumber(receipt) },
              { label: 'Method', value: receipt.method ? formatMethod(receipt.method) : 'N/A' },
              { label: 'Type', value: receipt.type ? formatType(receipt.type) : 'N/A' },
              ...(receipt.utrNumber
                ? [{ label: 'UTR', value: receipt.utrNumber, mono: true }]
                : []),
              {
                label: 'Paid at',
                value: formatDateTime(receipt.paidAt ?? receipt.createdAt),
              },
            ]}
            notes={receipt.notes || undefined}
            footerNote="This receipt was generated by the PG management system."
            showActions
            onPrint={printReceipt}
            onClose={() => setReceiptOpen(false)}
          />
        )}
      </Modal>

      {/* Verify modal (shared) */}
      <VerifyPaymentModal
        target={verifyOpen ? verifyTarget : null}
        loading={verifying}
        onDecide={handleVerify}
        onClose={() => setVerifyOpen(false)}
      />
    </FormPage>
  );
}
