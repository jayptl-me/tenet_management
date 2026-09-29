'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  Receipt,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';
import { StatCard } from '@/components/ui/StatCard';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { RecordPaymentModal } from '@/components/admin/RecordPaymentModal';
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
  paidAmount: number;
  balance: number;
  status: string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  payments?: PaymentRecord[];
  whatsAppUrl?: string;
  pgBranding?: PgBranding;
  electricityDetails?: ElectricityDetails | null;
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

const paymentColumns: DataTableColumn<PaymentRecord>[] = [
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
      <span className="capitalize text-(--color-text-secondary)">
        {p.method.replace('_', ' ')}
      </span>
    ),
  },
  {
    header: 'Status',
    accessor: (p) => (
      <StatusBadge
        variant={statusToVariant(p.status)}
        label={p.status.replace('_', ' ')}
      />
    ),
    className: 'text-right',
  },
];

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [recordTarget, setRecordTarget] = useState<import('@/components/admin/RecordPaymentModal').RecordPaymentTarget | null>(null);

  const fetchInvoice = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api
        .get(`invoices/${params.id}`)
        .json<{ success: boolean; data: InvoiceDetail }>();
      setInvoice(res.data);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  if (!isLoading && (error || !invoice)) {
    return (
      <FormPage
        title="Invoice Details"
        description="View invoice information"
        backHref="/invoices"
        error={error || 'Invoice not found'}
        maxWidth="4xl"
      />
    );
  }

  const tenantRaw = invoice?.tenantId;
  const tenantObj = typeof tenantRaw === 'object' && tenantRaw !== null ? tenantRaw : undefined;
  const tenantId = tenantObj?._id ?? (typeof tenantRaw === 'string' ? tenantRaw : undefined);
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
  const isOverdue = overdueDays != null && overdueDays > 0 && (invoice?.balance ?? 0) > 0;

  const payProgress =
    invoice && invoice.totalAmount > 0
      ? Math.min(100, Math.round((invoice.paidAmount / invoice.totalAmount) * 100))
      : 0;

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
      balance: invoice?.balance ?? 0,
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
      maxWidth="4xl"
      badge={invoice ? <StatusBadge variant={statusVariant} label={statusLabel} /> : undefined}
      actions={
        invoice ? (
          <div className="flex flex-wrap items-center gap-2">
            {invoice.balance > 0 &&
              invoice.status !== 'paid' &&
              invoice.status !== 'cancelled' &&
              tenantId && (
                <Button variant="primary" size="sm" onClick={openRecordModal}>
                  <CreditCard className="h-4 w-4" />
                  Record Payment
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
              value={formatCurrency(invoice.paidAmount)}
              subtitle={`${payProgress}% settled`}
              tone="success"
              icon={<CheckCircle2 />}
            />
            <StatCard
              title="Balance Due"
              value={formatCurrency(invoice.balance)}
              subtitle={invoice.balance > 0 ? 'outstanding' : 'fully cleared'}
              tone={invoice.balance > 0 ? 'danger' : 'success'}
              icon={<TriangleAlert />}
            />
            <StatCard
              title="Due Date"
              value={formatDate(invoice.dueDate)}
              subtitle={
                isOverdue && overdueDays != null
                  ? `${overdueDays} days past due`
                  : 'on schedule'
              }
              tone={isOverdue ? 'danger' : 'default'}
              icon={<Clock />}
            />
          </div>

          {isOverdue && (
            <div className="flex items-start gap-2.5 rounded-(--radius-lg) border border-(--color-danger-200) bg-(--color-danger-50) px-4 py-3 text-sm font-semibold text-(--color-danger-800)">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-(--color-danger-600)" />
              This invoice is {overdueDays} day(s) past its due date with{' '}
              {formatCurrency(invoice.balance)} outstanding.
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Document column */}
            <div className={clsx(surfaceCardClass, 'overflow-hidden lg:col-span-3')}>
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
                      <p className="mt-0.5 flex items-center gap-1 text-2xs text-(--color-text-muted)">
                        <MapPin className="h-3 w-3" />
                        {formatAddress(branding.address)}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-0.5 text-right text-2xs text-(--color-text-secondary)">
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
                      <p className="font-mono text-3xs text-(--color-text-muted)">
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
                  <p className="text-2xs font-bold tracking-label text-(--color-text-muted) uppercase">
                    Billing month
                  </p>
                  <p className="text-sm font-bold text-(--color-text-primary)">
                    {formatMonth(invoice.month)}
                  </p>
                  <p className="mt-1 text-2xs font-medium text-(--color-text-muted)">
                    Due {formatDate(invoice.dueDate)}
                  </p>
                </div>
              </div>

              {/* Bill-to */}
              <div className="grid grid-cols-1 gap-4 border-b border-(--border-color) px-6 py-4 sm:grid-cols-2">
                <div>
                  <p className="text-2xs font-bold tracking-label text-(--color-text-muted) uppercase">
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
                    <p className="text-2xs font-bold tracking-label text-(--color-text-muted) uppercase">
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
                <div className="flex items-center justify-between border-b border-(--border-color) bg-(--color-field-bg) px-6 py-3 text-2xs font-bold tracking-wider text-(--color-text-muted) uppercase">
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
                      <span className="text-right tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-(--border-color)">
                  <div className="flex items-center justify-between px-6 py-2.5 text-13 font-semibold text-(--color-text-secondary)">
                    <span>Subtotal</span>
                    <span className="text-right font-semibold text-(--color-text-primary) tabular-nums">
                      {formatCurrency(invoice.totalAmount)}
                    </span>
                  </div>
                  <div className="font-display flex items-center justify-between border-t border-(--border-color) bg-(--color-field-bg) px-6 py-3 text-15 font-bold text-(--color-text-primary)">
                    <span>Amount due</span>
                    <span className="text-right tabular-nums">
                      {formatCurrency(invoice.balance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment stub */}
              <div className="border-t border-(--border-color) px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xs font-bold tracking-label text-(--color-text-muted) uppercase">
                    Payment progress
                  </p>
                  <p className="text-xs font-bold text-(--color-text-primary) tabular-nums">
                    {payProgress}%
                  </p>
                </div>
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
              </div>
            </div>

            {/* Side column */}
            <div className="space-y-6 lg:col-span-2">
              <DetailCard title="Quick Actions" icon={<FileDown />}>
                <div className="flex flex-col gap-3">
                  {invoice.balance > 0 &&
                    invoice.status !== 'paid' &&
                    invoice.status !== 'cancelled' &&
                    tenantId && (
                      <Button variant="primary" onClick={openRecordModal}>
                        <CreditCard className="h-4 w-4" />
                        Record Payment (In-Place)
                      </Button>
                    )}
                  {tenantId && (
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/tenants/${tenantId}`)}
                    >
                      <User className="h-4 w-4" />
                      View Tenant Profile
                    </Button>
                  )}
                  <Button
                    variant={
                      invoice.balance > 0 &&
                      invoice.status !== 'paid' &&
                      invoice.status !== 'cancelled'
                        ? 'outline'
                        : 'primary'
                    }
                    onClick={downloadPdf}
                  >
                    <FileDown className="h-4 w-4" />
                    Download PDF
                  </Button>
                  {invoice.electricityDetails?.billId && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/electricity/${invoice.electricityDetails?.billId}`)
                      }
                    >
                      <Zap className="h-4 w-4" />
                      View Electricity Bill
                    </Button>
                  )}
                  {tenantPhone && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const text = [
                          `Invoice ${invoice.invoiceNumber}`,
                          `Amount: ${formatCurrency(invoice.totalAmount)}`,
                          `Balance: ${formatCurrency(invoice.balance)}`,
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
              </DetailCard>

              {invoice.payments && invoice.payments.length > 0 && (
                <DetailCard title="Payment History" icon={<CreditCard />}>
                  <DataTable
                    columns={paymentColumns}
                    data={invoice.payments}
                    keyExtractor={(p) => p._id}
                    onRowClick={(p) => router.push(`/payments/${p._id}`)}
                  />
                </DetailCard>
              )}

              {invoice.payments && invoice.payments.length > 0 && (
                <DetailCard title="Payment Timeline" icon={<Receipt />}>
                  <Timeline
                    events={invoice.payments.map((p) => ({
                      id: p._id,
                      date: p.paidAt ?? invoice.createdAt,
                      title: `${formatCurrency(p.amount)} via ${p.method.replace(/_/g, ' ')}`,
                      description: p.utrNumber ? `UTR: ${p.utrNumber}` : undefined,
                      status: (p.status === 'paid' ? 'success' : 'warning') as
                        'success' | 'warning',
                    }))}
                  />
                </DetailCard>
              )}

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
                  <DetailRow
                    label="Tenant"
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
                  <DetailRow label="Created" value={formatDate(invoice.createdAt)} />
                </DetailList>
              </DetailCard>
            </div>
          </div>

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
            onSuccess={() => {
              setRecordTarget(null);
              fetchInvoice();
            }}
          />
        </div>
      )}
    </FormPage>
  );
}
