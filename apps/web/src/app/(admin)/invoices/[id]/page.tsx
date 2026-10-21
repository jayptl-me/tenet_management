'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileDown,
  MessageCircle,
  CreditCard,
  Pencil,
  User,
  Home,
  Building,
  Hash,
  TriangleAlert,
  IndianRupee,
  CheckCircle2,
  Clock,
  Building2,
  MapPin,
  Phone,
  Mail,
  History,
  ExternalLink,
  Zap,
  Ban,
  Scale,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { StatusStepper } from '@/components/ui/StatusStepper';
import { Timeline } from '@/components/ui/Timeline';
import { StatCard } from '@/components/ui/StatCard';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { FormPage } from '@/components/ui/FormPage';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import {
  RecordPaymentModal,
  type RecordPaymentTarget,
} from '@/components/admin/RecordPaymentModal';
import {
  buildPaymentReceipt,
  ReceiptDocument,
  type PaymentReceiptSource,
} from '@/components/admin/ReceiptDocument';
import { surfaceCardClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

interface LineItem {
  description: string;
  amount: number;
}

interface PaymentRecord {
  _id: string;
  amount: number;
  method: string;
  status: string;
  type?: string;
  paidAt?: string;
  createdAt?: string;
  utrNumber?: string;
  notes?: string;
}

interface UserInfo {
  name: string;
  email?: string;
  phone?: string;
}

interface TenantInfo {
  _id: string;
  bedId?: string | null;
  userId?: UserInfo;
  roomId?: {
    _id: string;
    roomNumber: string;
    floorId?: { _id?: string; label?: string; floorNumber?: number };
  };
}

interface AddressObject {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface PgBranding {
  pgName?: string;
  tagline?: string;
  address?: string | AddressObject;
  phone?: string;
  email?: string;
  gstNumber?: string;
  upiId?: string;
  upiPayeeName?: string;
}

interface ElectricityDetails {
  billId: string;
  month: string;
  billStatus: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  roomTotalAmount: number;
  tenantShare: number;
  billImageUrl?: string | null;
}

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  tenantId?: TenantInfo | string;
  month: string;
  lineItems: LineItem[];
  rentAmount: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  /** Server-computed settled sum. Absent when the server did not report one. */
  paidAmount?: number;
  /** Server-computed amount still due. Absent when the server did not report one. */
  balance?: number | null;
  status: string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  payments?: PaymentRecord[];
  whatsAppUrl?: string;
  pgBranding?: PgBranding;
  electricityDetails?: ElectricityDetails | null;
}

/** The money the resident owes across every open invoice (GET /tenants/:id/dues). */
interface TenantDues {
  totalDue?: number;
  unpaidInvoices?: Array<{
    _id: string;
    invoiceNumber?: string;
    month?: string;
    remaining?: number | null;
    status?: string;
  }>;
}

/** One audit entry of the invoice (GET /audit-logs). */
interface AuditEvent {
  _id?: string;
  id?: string;
  action: string;
  resourceId?: string;
  timestamp?: string;
  details?: Record<string, unknown>;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

/**
 * A money number the server may not have reported.
 *
 * An absent number is "not reported", never 0: a zero balance means nothing
 * is due, and reading a missing number as 0 would claim the invoice is
 * settled when nobody said so.
 */
function formatMoneyOrNotReported(amount: number | null | undefined): string {
  return typeof amount === 'number' ? formatCurrency(amount) : 'Not reported';
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

function formatAddress(address: PgBranding['address']): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

function daysPastDue(dueDate: string | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000));
}

/** The title of an audit entry, in the language of the office. */
function auditTitle(event: AuditEvent): string {
  switch (event.action) {
    case 'create':
      return 'Invoice issued';
    case 'update':
      return 'Invoice updated';
    case 'delete':
      return 'Invoice deleted';
    case 'export':
      return 'Invoice exported';
    default:
      return event.action.replace(/_/g, ' ');
  }
}

/** The detail of an audit entry, read from what the server wrote. */
function auditDescription(event: AuditEvent): string | undefined {
  const details = event.details;
  if (!details) return undefined;
  const parts: string[] = [];
  if (typeof details.status === 'string') parts.push(`status ${details.status}`);
  if (typeof details.totalAmount === 'number') parts.push(formatCurrency(details.totalAmount));
  if (typeof details.month === 'string') parts.push(details.month);
  if (typeof details.invoiceNumber === 'string') parts.push(details.invoiceNumber);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

const INVOICE_KEY = (id: string) => ['invoices', id] as const;

const INVOICE_EVENTS_KEY = (id: string) => ['invoices', id, 'audit-logs'] as const;

const INVOICES_PREFIX = ['invoices'] as const;

const PAYMENTS_SUMMARY_PREFIX = ['payments', 'summary'] as const;

const TENANT_DUES_KEY = (tenantId: string) => ['tenants', tenantId, 'dues'] as const;

/**
 * The columns of the payment history.
 *
 * Every row is a payment record of its own, so every row links to it: the
 * office can open the record instead of guessing which row it was.
 */
const paymentColumns: DataTableColumn<PaymentRecord>[] = [
  {
    header: 'Payment',
    accessor: (p) => (
      <Link
        href={`/payments/${p._id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-mono text-xs font-bold text-(--color-brand-600) hover:underline"
      >
        {p.utrNumber ? `UTR ${p.utrNumber}` : p._id.slice(-8)}
      </Link>
    ),
  },
  {
    header: 'Amount',
    accessor: (p) => (
      <span className="font-bold text-(--color-brand-700) tabular-nums">
        {formatCurrency(p.amount)}
      </span>
    ),
  },
  {
    header: 'Method',
    accessor: (p) => (
      <span className="text-(--color-text-secondary) capitalize">{p.method.replace('_', ' ')}</span>
    ),
  },
  {
    header: 'Status',
    accessor: (p) => (
      <StatusBadge variant={statusToVariant(p.status)} label={p.status.replace('_', ' ')} />
    ),
  },
  {
    header: 'Date',
    accessor: (p) => formatDate(p.paidAt ?? p.createdAt),
  },
];

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [recordTarget, setRecordTarget] = useState<RecordPaymentTarget | null>(null);
  // Server-issued receipt of the payment that was just recorded.
  const [receipt, setReceipt] = useState<PaymentReceiptSource | null>(null);
  // Outcome of the last write, as reported by the server.
  const [writeResult, setWriteResult] = useState('');
  // A refusal from the server, named as the server named it.
  const [writeError, setWriteError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const {
    data: invoice = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<InvoiceDetail>(INVOICE_KEY(params.id), `invoices/${params.id}`);
  const queryErrorMessage = errorMessage(queryError);

  const tenantRaw = invoice?.tenantId;
  const tenantObj = typeof tenantRaw === 'object' && tenantRaw !== null ? tenantRaw : undefined;
  const tenantId = tenantObj?._id ?? (typeof tenantRaw === 'string' ? tenantRaw : undefined);

  /**
   * The resident's own picture of what they owe.
   *
   * The dues summary is the server's: the total across every open invoice and
   * the balance each one still carries. The page never adds up the invoices
   * itself.
   */
  const { data: tenantDues = null, isPending: duesPending } = useApiQuery<TenantDues>(
    TENANT_DUES_KEY(tenantId ?? ''),
    `tenants/${tenantId}/dues`,
    { enabled: Boolean(tenantId) },
  );

  /**
   * The trail of this invoice.
   *
   * The audit route cannot filter by record id, so the newest invoice entries
   * are read and the ones of this invoice are picked out here. The card says
   * so, because a trail that is silently incomplete is a lie.
   */
  const { data: auditRows = [] } = useApiQuery<AuditEvent[]>(
    INVOICE_EVENTS_KEY(params.id),
    `audit-logs?resource=invoice&limit=100`,
  );
  const events = auditRows.filter((event) => event.resourceId === params.id);

  /**
   * Re-read the invoice and everything that hangs off it, so the page renders
   * the server state instead of a locally asserted outcome.
   */
  const refreshAfterMutation = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: INVOICE_KEY(params.id) }),
      queryClient.invalidateQueries({ queryKey: INVOICE_EVENTS_KEY(params.id) }),
      queryClient.invalidateQueries({ queryKey: INVOICES_PREFIX }),
      queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_PREFIX }),
      ...(tenantId ? [queryClient.invalidateQueries({ queryKey: TENANT_DUES_KEY(tenantId) })] : []),
    ]);
  };

  /**
   * Void the bill.
   *
   * The server refuses a cancel while the invoice still carries a balance
   * (INVOICE_HAS_BALANCE) and refuses to edit a paid one. The refusal is
   * shown as the server wrote it, and the invoice is read again afterwards.
   */
  const handleCancel = async () => {
    if (!invoice) return;
    setCancelling(true);
    setWriteError('');
    try {
      const res = await api
        .put(`invoices/${invoice._id}`, { json: { status: 'cancelled' } })
        .json<{ success: boolean; data?: { status?: string } }>();
      setCancelOpen(false);
      await refreshAfterMutation();
      setWriteResult(
        `Cancellation saved. Server status of the invoice: ${res.data?.status ?? 'unknown'}. The resident was notified.`,
      );
    } catch (err) {
      setCancelOpen(false);
      setWriteError((await parseApiError(err)).message);
    } finally {
      setCancelling(false);
    }
  };

  if (!isLoading && (queryErrorMessage || !invoice)) {
    return (
      <FormPage
        title="Invoice Details"
        description="View invoice information"
        backHref="/invoices"
        error={queryErrorMessage || 'Invoice not found'}
        maxWidth="full"
      />
    );
  }

  const tenantName = tenantObj?.userId?.name ?? 'N/A';
  const tenantPhone = tenantObj?.userId?.phone;

  const roomObj = tenantObj?.roomId;
  const roomId = roomObj?._id;
  const roomNumber = roomObj?.roomNumber ?? 'N/A';

  const floorData = roomObj?.floorId;
  const floorObj = typeof floorData === 'object' && floorData !== null ? floorData : undefined;
  const floorId = floorObj?._id ?? (typeof floorData === 'string' ? floorData : undefined);
  const floorName =
    floorObj?.label ?? (floorObj?.floorNumber != null ? `Floor ${floorObj.floorNumber}` : 'N/A');

  const statusLabel = invoice
    ? invoice.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const statusVariant = invoice ? statusToVariant(invoice.status) : 'neutral';
  const overdueDays = daysPastDue(invoice?.dueDate);
  // A missing balance is not a zero balance: only a REPORTED balance can make
  // the invoice overdue, and only a reported one can make it collectible.
  const reportedBalance = typeof invoice?.balance === 'number' ? invoice.balance : null;
  const isOverdue = overdueDays != null && overdueDays > 0 && (reportedBalance ?? 0) > 0;

  // A cancelled invoice cannot be collected: the server refuses a payment on
  // it, so the page must not offer a collectible-looking balance.
  const isCancelled = invoice?.status === 'cancelled';
  const isPaid = invoice?.status === 'paid';
  const isCollectible =
    invoice != null && invoice.status !== 'paid' && invoice.status !== 'cancelled';

  // The payment progress needs both server numbers. Without them the page
  // says so instead of claiming 0%.
  const payProgress =
    invoice && typeof invoice.paidAmount === 'number' && invoice.totalAmount > 0
      ? Math.min(100, Math.round((invoice.paidAmount / invoice.totalAmount) * 100))
      : null;

  // The dues summary is only read as a number when the server sent one.
  const residentTotalDue =
    tenantDues && typeof tenantDues.totalDue === 'number' ? tenantDues.totalDue : null;
  const residentOpenInvoices =
    tenantDues && Array.isArray(tenantDues.unpaidInvoices) ? tenantDues.unpaidInvoices : null;

  const openRecordModal = () => {
    if (!tenantId) return;
    setRecordTarget({
      tenantId,
      tenantName,
      roomNumber,
      invoiceId: invoice?._id ?? '',
      invoiceNumber: invoice?.invoiceNumber ?? '',
      month: invoice?.month ?? '',
      totalAmount: invoice?.totalAmount ?? 0,
      // Undefined when the server did not report a balance: the modal must be
      // able to say "not reported" instead of blocking every amount.
      balance: reportedBalance ?? undefined,
    });
  };

  const downloadPdf = async () => {
    if (!invoice) return;
    try {
      const blob = await api.get(`invoices/${invoice._id}/pdf`).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF. Ensure you are logged in.');
    }
  };

  const branding = invoice?.pgBranding;

  return (
    <FormPage
      title={invoice?.invoiceNumber ?? 'Invoice Details'}
      description={
        invoice
          ? `${formatMonth(invoice.month)} · Created ${formatDate(invoice.createdAt)}`
          : 'View invoice information'
      }
      backHref="/invoices"
      isLoading={isLoading}
      maxWidth="full"
      badge={invoice ? <StatusBadge variant={statusVariant} label={statusLabel} /> : undefined}
      actions={
        invoice ? (
          <div className="flex flex-wrap items-center gap-2">
            {isCollectible && tenantId && (
              <Button variant="primary" size="sm" onClick={openRecordModal}>
                <CreditCard className="h-4 w-4" />
                Record Payment
              </Button>
            )}
            {isCollectible && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" />
                Cancel invoice
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileDown className="h-4 w-4" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/invoices/${invoice._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {invoice && (
        <div className="space-y-6">
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
              {writeResult}
            </div>
          )}
          <ErrorBanner message={writeError} />

          {/* Executive Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Invoice Total"
              value={formatCurrency(invoice.totalAmount)}
              subtitle={formatMonth(invoice.month)}
              tone="brand"
              icon={<IndianRupee />}
            />
            <StatCard
              title="Settled / Paid"
              value={formatMoneyOrNotReported(invoice.paidAmount)}
              subtitle={payProgress != null ? `${payProgress}% settled` : 'not reported'}
              tone="success"
              icon={<CheckCircle2 />}
            />
            <StatCard
              title={isCancelled ? 'Balance' : 'Balance Due'}
              value={isCancelled ? 'Not collectible' : formatMoneyOrNotReported(reportedBalance)}
              subtitle={
                isCancelled
                  ? 'this invoice was cancelled'
                  : reportedBalance == null
                    ? 'not reported'
                    : reportedBalance > 0
                      ? 'outstanding'
                      : 'fully cleared'
              }
              tone={
                isCancelled
                  ? 'default'
                  : reportedBalance != null && reportedBalance > 0
                    ? 'danger'
                    : 'success'
              }
              icon={<TriangleAlert />}
            />
            <StatCard
              title="Due Date"
              value={formatDate(invoice.dueDate)}
              subtitle={
                isOverdue && overdueDays != null ? `${overdueDays} days past due` : 'on schedule'
              }
              tone={isOverdue ? 'danger' : 'default'}
              icon={<Clock />}
            />
          </div>

          {isOverdue && (
            <div className="flex items-start gap-2.5 rounded-(--radius-lg) border border-(--color-danger-200) bg-(--color-danger-50) px-4 py-3 text-sm font-semibold text-(--color-danger-800)">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-(--color-danger-600)" />
              This invoice is {overdueDays} day(s) past its due date with{' '}
              {formatMoneyOrNotReported(reportedBalance)} outstanding.
            </div>
          )}

          {/* The context rail is a slot of the shell frame, not a grid this
              page builds for itself: the resident, the money they owe and the
              office actions stay in view while the invoice scrolls. */}
          <ContentFrame
            rail={
              <>
                <DetailCard title="Resident" icon={<User />}>
                  <DetailList>
                    <DetailRow
                      label="Name"
                      value={
                        tenantId ? (
                          <Link
                            href={`/tenants/${tenantId}`}
                            className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) hover:underline"
                          >
                            {tenantName}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          tenantName
                        )
                      }
                    />
                    <DetailRow
                      label="Room"
                      value={
                        roomId ? (
                          <Link
                            href={`/rooms/${roomId}`}
                            className="font-semibold text-(--color-brand-600) hover:underline"
                          >
                            Room {roomNumber}
                          </Link>
                        ) : (
                          roomNumber
                        )
                      }
                    />
                    {tenantObj?.bedId ? <DetailRow label="Bed" value={tenantObj.bedId} /> : null}
                    <DetailRow
                      label="Floor"
                      value={
                        floorId ? (
                          <Link
                            href={`/floors/${floorId}`}
                            className="font-semibold text-(--color-brand-600) hover:underline"
                          >
                            {floorName}
                          </Link>
                        ) : (
                          floorName
                        )
                      }
                    />
                    {tenantPhone ? <DetailRow label="Phone" value={tenantPhone} /> : null}
                  </DetailList>
                </DetailCard>

                {/* What the resident owes next, in the resident's own view.
                    The numbers are the server's dues summary. */}
                <DetailCard title="Resident dues" icon={<Scale />}>
                  <DetailList>
                    <DetailRow
                      label="Owes in total"
                      value={
                        residentTotalDue != null ? (
                          <span
                            className={clsx(
                              'tabular-nums',
                              residentTotalDue > 0
                                ? 'text-(--color-danger-600)'
                                : 'text-(--color-success-600)',
                            )}
                          >
                            {formatCurrency(residentTotalDue)}
                          </span>
                        ) : duesPending ? (
                          'loading'
                        ) : (
                          'not reported'
                        )
                      }
                    />
                    <DetailRow
                      label="Open invoices"
                      value={
                        residentOpenInvoices
                          ? String(residentOpenInvoices.length)
                          : duesPending
                            ? 'loading'
                            : 'not reported'
                      }
                    />
                    <DetailRow
                      label="This invoice"
                      value={
                        reportedBalance == null
                          ? 'not reported'
                          : `${formatCurrency(reportedBalance)} due`
                      }
                    />
                  </DetailList>
                  {residentOpenInvoices && residentOpenInvoices.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {residentOpenInvoices.map((open) => (
                        <Link
                          key={open._id}
                          href={`/invoices/${open._id}`}
                          className="flex items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) px-2.5 py-1.5 text-xs font-semibold text-(--text-secondary) hover:border-(--color-brand-300)"
                        >
                          <span>
                            {open.invoiceNumber ?? open._id.slice(-6)}
                            {open.month ? ` · ${open.month}` : ''}
                          </span>
                          <span className="tabular-nums">
                            {typeof open.remaining === 'number'
                              ? formatCurrency(open.remaining)
                              : 'not reported'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                    The dues summary is the server&apos;s. A balance the server did not report is
                    never read as zero.
                  </p>
                </DetailCard>

                <DetailCard title="Office actions" icon={<CreditCard />}>
                  <div className="flex flex-col gap-3">
                    {isCollectible && tenantId && (
                      <Button variant="primary" onClick={openRecordModal}>
                        <CreditCard className="h-4 w-4" />
                        Record Payment
                      </Button>
                    )}
                    {isCollectible && (
                      <Button variant="outline" onClick={() => setCancelOpen(true)}>
                        <Ban className="h-4 w-4" />
                        Cancel invoice
                      </Button>
                    )}
                    <Button variant="outline" onClick={downloadPdf}>
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
                            `Balance: ${formatMoneyOrNotReported(reportedBalance)}`,
                            'Please check the resident portal or contact the admin for the PDF copy.',
                          ].join('\n');
                          window.open(
                            generateWhatsAppUrl(tenantPhone, text),
                            '_blank',
                            'noopener,noreferrer',
                          );
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
                      Edit Line Items
                    </Button>
                  </div>
                  {isCancelled && (
                    <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                      This invoice was cancelled, so it is not collectible. The server refuses a
                      payment against it.
                    </p>
                  )}
                  {isPaid && (
                    <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                      This invoice is settled. The server locks its amounts and its status.
                    </p>
                  )}
                </DetailCard>

                {invoice.electricityDetails ? (
                  <DetailCard
                    title="Electricity Meter Breakdown"
                    icon={<Zap />}
                    action={
                      <Link
                        href={`/electricity/${invoice.electricityDetails.billId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-(--color-brand-600) hover:underline"
                      >
                        View Master Bill
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    }
                  >
                    <DetailList>
                      <DetailRow
                        label="Bill Status"
                        value={
                          <StatusBadge
                            variant={statusToVariant(invoice.electricityDetails.billStatus)}
                            label={invoice.electricityDetails.billStatus}
                          />
                        }
                      />
                      <DetailRow
                        label="Meter Readings"
                        value={`${invoice.electricityDetails.previousReading} -> ${invoice.electricityDetails.currentReading}`}
                      />
                      <DetailRow
                        label="Units Consumed"
                        value={`${invoice.electricityDetails.unitsConsumed} units`}
                      />
                      <DetailRow
                        label="Rate per Unit"
                        value={`₹${invoice.electricityDetails.ratePerUnit}`}
                      />
                      <DetailRow
                        label="Room Total"
                        value={formatCurrency(invoice.electricityDetails.roomTotalAmount)}
                      />
                      <DetailRow
                        label="Tenant Share"
                        value={
                          <span className="font-bold text-(--color-brand-600)">
                            {formatCurrency(invoice.electricityDetails.tenantShare)}
                          </span>
                        }
                      />
                    </DetailList>
                  </DetailCard>
                ) : invoice.electricityAmount > 0 ? (
                  <DetailCard title="Electricity Charge" icon={<Zap />}>
                    <DetailList>
                      <DetailRow
                        label="Billed Electricity"
                        value={
                          <span className="font-bold text-(--color-brand-600)">
                            {formatCurrency(invoice.electricityAmount)}
                          </span>
                        }
                      />
                      <DetailRow
                        label="Status"
                        value="Electricity charge applied to invoice line items"
                      />
                    </DetailList>
                  </DetailCard>
                ) : null}

                <DetailCard title="Invoice Meta" icon={<Hash />}>
                  <DetailList>
                    <DetailRow label="Invoice #" value={invoice.invoiceNumber} />
                    <DetailRow label="Billing month" value={formatMonth(invoice.month)} />
                    <DetailRow label="Due date" value={formatDate(invoice.dueDate)} />
                    <DetailRow label="Created" value={formatDate(invoice.createdAt)} />
                    <DetailRow label="Status" value={statusLabel} />
                  </DetailList>
                </DetailCard>
              </>
            }
          >
            {/* The state machine of the record. The states, their order and
                the transitions come from the shared vocabulary, so this page
                cannot drift from the portal. */}
            <DetailCard title="Invoice progress" icon={<CheckCircle2 />}>
              <StatusStepper domain="invoice" current={invoice.status} />
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                Paid is set by the money, not by hand: an invoice turns paid when the settled
                payments reach its total, and partial while some money is in and the rest is not.
                Overdue is written by the daily sweep, and a cancel is the office&apos;s decision.
              </p>
            </DetailCard>

            {/* Document column */}
            <div className={clsx(surfaceCardClass, 'overflow-hidden')}>
              {/* Branded Property Header */}
              {branding && (branding.pgName || formatAddress(branding.address)) ? (
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-(--border-color) bg-(--color-surface-sunken) px-6 py-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-(--color-brand-600)" />
                      <span className="font-display text-sm font-bold text-(--color-text-primary)">
                        {branding.pgName || 'Property Management'}
                      </span>
                    </div>
                    {formatAddress(branding.address) ? (
                      <p className="text-2xs mt-0.5 flex items-center gap-1 text-(--color-text-muted)">
                        <MapPin className="h-3 w-3" />
                        {formatAddress(branding.address)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-2xs space-y-0.5 text-right text-(--color-text-secondary)">
                    {branding.phone && (
                      <p className="flex items-center justify-end gap-1">
                        <Phone className="h-3 w-3" />
                        {branding.phone}
                      </p>
                    )}
                    {branding.email && (
                      <p className="flex items-center justify-end gap-1">
                        <Mail className="h-3 w-3" />
                        {branding.email}
                      </p>
                    )}
                    {branding.gstNumber && (
                      <p className="text-3xs font-mono text-(--color-text-muted)">
                        GSTIN: {branding.gstNumber}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Document head */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-(--border-color) px-6 py-5">
                <div>
                  <p className="font-display text-lg font-bold tracking-tight text-(--color-text-primary)">
                    INVOICE
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-(--color-brand-700)">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                    Billing month
                  </p>
                  <p className="text-sm font-bold text-(--color-text-primary)">
                    {formatMonth(invoice.month)}
                  </p>
                  <p className="text-2xs mt-1 font-medium text-(--color-text-muted)">
                    Due {formatDate(invoice.dueDate)}
                  </p>
                </div>
              </div>

              {/* Bill-to */}
              <div className="grid grid-cols-1 gap-4 border-b border-(--border-color) px-6 py-4 sm:grid-cols-2">
                <div>
                  <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                    Billed to
                  </p>
                  {tenantId ? (
                    <Link
                      href={`/tenants/${tenantId}`}
                      className="group mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-(--color-text-primary) transition-colors hover:text-(--color-brand-600)"
                    >
                      <User className="h-3.5 w-3.5 text-(--color-text-muted) group-hover:text-(--color-brand-600)" />
                      <span className="hover:underline">{tenantName}</span>
                      <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                    </Link>
                  ) : (
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-(--color-text-primary)">
                      <User className="h-3.5 w-3.5 text-(--color-text-muted)" />
                      {tenantName}
                    </p>
                  )}
                  <div className="mt-1 space-y-0.5 text-xs font-medium text-(--color-text-secondary)">
                    <span className="flex items-center gap-1.5">
                      <Home className="h-3 w-3 text-(--color-text-muted)" />
                      {roomId ? (
                        <Link
                          href={`/rooms/${roomId}`}
                          className="hover:text-(--color-brand-600) hover:underline"
                        >
                          Room {roomNumber}
                        </Link>
                      ) : (
                        `Room ${roomNumber}`
                      )}
                      {tenantObj?.bedId ? ` · Bed ${tenantObj.bedId}` : ''}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <Building className="h-3 w-3 text-(--color-text-muted)" />
                      {floorId ? (
                        <Link
                          href={`/floors/${floorId}`}
                          className="hover:text-(--color-brand-600) hover:underline"
                        >
                          {floorName}
                        </Link>
                      ) : (
                        floorName
                      )}
                    </span>
                  </div>
                </div>
                {tenantPhone && (
                  <div className="sm:text-right">
                    <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                      Contact
                    </p>
                    <p className="mt-1 text-sm font-semibold text-(--color-text-primary)">
                      {tenantPhone}
                    </p>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div className="w-full text-sm">
                <div className="text-2xs flex items-center justify-between border-b border-(--border-color) bg-(--color-field-bg) px-6 py-3 font-bold tracking-wider text-(--color-text-muted) uppercase">
                  <span>Description</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-(--border-color)">
                  {(invoice.lineItems && invoice.lineItems.length > 0
                    ? invoice.lineItems
                    : [
                        { description: 'Monthly Rent', amount: invoice.rentAmount },
                        ...(invoice.electricityAmount > 0
                          ? [{ description: 'Electricity', amount: invoice.electricityAmount }]
                          : []),
                        ...(invoice.otherCharges > 0
                          ? [{ description: 'Other Charges', amount: invoice.otherCharges }]
                          : []),
                      ]
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-6 py-3 font-semibold text-(--color-text-primary)"
                    >
                      <span>{item.description}</span>
                      <span className="text-right tabular-nums">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-(--border-color)">
                  <div className="text-13 flex items-center justify-between px-6 py-2.5 font-semibold text-(--color-text-secondary)">
                    <span>Subtotal</span>
                    <span className="text-right font-semibold text-(--color-text-primary) tabular-nums">
                      {formatCurrency(invoice.totalAmount)}
                    </span>
                  </div>
                  <div className="font-display text-15 flex items-center justify-between border-t border-(--border-color) bg-(--color-field-bg) px-6 py-3 font-bold text-(--color-text-primary)">
                    <span>Amount due</span>
                    <span className="text-right tabular-nums">
                      {isCancelled
                        ? 'Cancelled - not collectible'
                        : formatMoneyOrNotReported(reportedBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment stub */}
              <div className="border-t border-(--border-color) px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                    Payment progress
                  </p>
                  <p className="text-xs font-bold text-(--color-text-primary) tabular-nums">
                    {payProgress != null ? `${payProgress}%` : 'Not reported'}
                  </p>
                </div>
                {payProgress != null ? (
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-(--radius-full) bg-(--chart-track)"
                    role="progressbar"
                    aria-valuenow={payProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Payment progress"
                  >
                    <div
                      className="h-full w-(--pay-progress) rounded-(--radius-full) bg-(--color-success-500) transition-all duration-500"
                      style={{ '--pay-progress': `${payProgress}%` } as CSSProperties}
                    />
                  </div>
                ) : (
                  <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                    The server did not report the settled amount for this invoice.
                  </p>
                )}
              </div>
            </div>

            {/* The payments that settle this bill. Every row is a record of
                its own, so the office can open it. */}
            {invoice.payments && invoice.payments.length > 0 && (
              <DetailCard title="Payment history" icon={<CreditCard />}>
                <DataTable
                  columns={paymentColumns}
                  data={invoice.payments}
                  keyExtractor={(p) => p._id}
                  onRowClick={(p) => router.push(`/payments/${p._id}`)}
                />
                <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                  Every row is a payment record of its own: the link opens it.
                </p>
              </DetailCard>
            )}

            {/* The trail of the record. The audit route cannot filter by
                record, so the card says what it holds. */}
            <DetailCard title="Activity" icon={<History />}>
              {events.length > 0 ? (
                <Timeline
                  events={events.map((event, index) => ({
                    id: event.id ?? event._id ?? `audit-${index}`,
                    date: event.timestamp ?? '',
                    title: auditTitle(event),
                    description: auditDescription(event),
                    status:
                      event.action === 'create'
                        ? ('success' as const)
                        : event.action === 'delete'
                          ? ('danger' as const)
                          : ('info' as const),
                  }))}
                />
              ) : (
                <p className="text-xs font-medium text-(--color-text-muted)">
                  No audit entry for this invoice in the newest invoice entries the server keeps.
                </p>
              )}
              <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                The audit route cannot filter by record, so this is the trail of this invoice inside
                the newest 100 invoice entries.
              </p>
            </DetailCard>
          </ContentFrame>

          {invoice.updatedAt && (
            <p className="text-right text-xs font-semibold text-(--color-text-muted)">
              Last updated: {new Date(invoice.updatedAt).toLocaleString('en-IN')}
            </p>
          )}

          {/* In-place Record Payment Modal */}
          <RecordPaymentModal
            target={recordTarget}
            isOpen={!!recordTarget}
            onClose={() => setRecordTarget(null)}
            onSuccess={(paymentReceipt) => {
              // The invoice balance and status come from the server now.
              queryClient.invalidateQueries({ queryKey: INVOICES_PREFIX });
              queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_PREFIX });
              setReceipt(paymentReceipt);
            }}
          />

          {/* Server-issued receipt of the recorded payment */}
          <Modal
            open={!!receipt}
            onClose={() => setReceipt(null)}
            title="Payment receipt"
            size="sm"
            loading={false}
          >
            {receipt && (
              <ReceiptDocument
                {...buildPaymentReceipt(receipt)}
                showActions
                onPrint={() => window.print()}
                onClose={() => setReceipt(null)}
              />
            )}
          </Modal>

          {/* The cancel is the office's decision, so it is asked for. The
              server refuses it while the invoice still carries a balance. */}
          <ConfirmModal
            open={cancelOpen}
            title="Cancel this invoice?"
            message="The bill is voided and the resident is notified. The server refuses the cancel while the invoice still carries a balance, and a paid invoice cannot be cancelled at all."
            confirmLabel="Cancel invoice"
            variant="danger"
            loading={cancelling}
            onConfirm={handleCancel}
            onCancel={() => setCancelOpen(false)}
          />
        </div>
      )}
    </FormPage>
  );
}
