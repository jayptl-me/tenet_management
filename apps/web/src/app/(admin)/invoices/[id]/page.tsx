'use client';

import { useEffect, useState } from 'react';
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
  CalendarClock,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';
import { KpiHeader } from '@/components/ui/KpiHeader';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
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

function daysPastDue(dueDate: string | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return Math.floor((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000));
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
      } catch (err) {
        setError((await parseApiError(err)).message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvoice();
  }, [params.id]);

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

  const tenantName = invoice?.tenantId?.userId?.name ?? 'N/A';
  const roomNumber = invoice?.tenantId?.roomId?.roomNumber ?? 'N/A';
  const floorData = invoice?.tenantId?.roomId?.floorId;
  const floorName =
    floorData?.label ?? (floorData?.floorNumber != null ? `Floor ${floorData.floorNumber}` : 'N/A');
  const tenantPhone = invoice?.tenantId?.userId?.phone;
  const statusLabel = invoice
    ? invoice.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const statusVariant = invoice ? statusToVariant(invoice.status) : 'neutral';
  const overdueDays = daysPastDue(invoice?.dueDate);
  const isOverdue =
    overdueDays != null && overdueDays > 0 && (invoice?.balance ?? 0) > 0;

  const payProgress =
    invoice && invoice.totalAmount > 0
      ? Math.min(100, Math.round((invoice.paidAmount / invoice.totalAmount) * 100))
      : 0;

  const downloadPdf = async () => {
    if (!invoice) return;
    try {
      // Must use authenticated ky client — window.open omits JWT → 401
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
          {/* KPI strip */}
          <KpiHeader
            items={[
              {
                label: 'Invoice total',
                value: formatCurrency(invoice.totalAmount),
                sub: formatMonth(invoice.month),
                tone: 'brand',
              },
              {
                label: 'Paid',
                value: formatCurrency(invoice.paidAmount),
                sub: `${payProgress}% of total`,
                tone: 'success',
              },
              {
                label: 'Balance due',
                value: formatCurrency(invoice.balance),
                sub: invoice.balance > 0 ? 'outstanding' : 'fully settled',
                tone: invoice.balance > 0 ? 'danger' : 'success',
              },
              {
                label: 'Due date',
                value: formatDate(invoice.dueDate),
                sub:
                  isOverdue && overdueDays != null
                    ? `${overdueDays} days past due`
                    : 'not yet past due',
                tone: isOverdue ? 'danger' : 'default',
                icon: <CalendarClock className="h-4 w-4" />,
              },
            ]}
          />

          {isOverdue && (
            <div className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] px-4 py-3 text-sm font-semibold text-[color:var(--color-danger-800)]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              This invoice is {overdueDays} day(s) past its due date with{' '}
              {formatCurrency(invoice.balance)} outstanding.
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Document column */}
            <div className={clsx(surfaceCardClass, 'overflow-hidden lg:col-span-3')}>
              {/* Document head */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--border-color)] px-6 py-5">
                <div>
                  <p className="font-display text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">
                    INVOICE
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-[color:var(--color-brand-700)]">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
                    Billing month
                  </p>
                  <p className="text-sm font-bold text-[color:var(--color-text-primary)]">
                    {formatMonth(invoice.month)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-[color:var(--color-text-muted)]">
                    Due {formatDate(invoice.dueDate)}
                  </p>
                </div>
              </div>

              {/* Bill-to */}
              <div className="grid grid-cols-1 gap-4 border-b border-[color:var(--border-color)] px-6 py-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
                    Billed to
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[color:var(--color-text-primary)]">
                    <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {tenantName}
                  </p>
                  <p className="mt-1 space-y-0.5 text-xs font-medium text-[color:var(--color-text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <Home className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                      Room {roomNumber}
                      {invoice.tenantId?.bedId ? ` · Bed ${invoice.tenantId.bedId}` : ''}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <Building className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                      {floorName}
                    </span>
                  </p>
                </div>
                {tenantPhone && (
                  <div className="sm:text-right">
                    <p className="text-[11px] font-bold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
                      Contact
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
                      {tenantPhone}
                    </p>
                  </div>
                )}
              </div>

              {/* Line items */}
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]">
                    <th className="px-6 py-3 text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-color)]">
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
                    <tr key={idx}>
                      <td className="px-6 py-3 font-semibold text-[color:var(--color-text-primary)]">
                        {item.description}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-[color:var(--color-text-primary)] tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[color:var(--border-color)]">
                    <td className="px-6 py-2.5 text-right text-[13px] font-semibold text-[color:var(--color-text-secondary)]">
                      Subtotal
                    </td>
                    <td className="px-6 py-2.5 text-right text-[13px] font-semibold text-[color:var(--color-text-primary)] tabular-nums">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                  </tr>
                  <tr className="border-t border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]">
                    <td className="px-6 py-3 text-right font-display text-[15px] font-bold text-[color:var(--color-text-primary)]">
                      Amount due
                    </td>
                    <td className="px-6 py-3 text-right font-display text-[15px] font-bold text-[color:var(--color-text-primary)] tabular-nums">
                      {formatCurrency(invoice.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Payment stub */}
              <div className="border-t border-[color:var(--border-color)] px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
                    Payment progress
                  </p>
                  <p className="text-xs font-bold text-[color:var(--color-text-primary)] tabular-nums">
                    {payProgress}%
                  </p>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-[var(--radius-full)] bg-[color:var(--chart-track)]"
                  role="progressbar"
                  aria-valuenow={payProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Payment progress"
                >
                  <div
                    className="h-full rounded-[var(--radius-full)] bg-[color:var(--color-success-500)] transition-[width] duration-500"
                    style={{ width: `${payProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Side column */}
            <div className="space-y-6 lg:col-span-2">
              <DetailCard title="Actions" icon={<FileDown />}>
                <div className="flex flex-col gap-3">
                  {invoice.balance > 0 &&
                    invoice.status !== 'paid' &&
                    invoice.status !== 'cancelled' &&
                    invoice.tenantId?._id && (
                      <Button
                        variant="primary"
                        onClick={() =>
                          router.push(
                            `/payments/new?tenantId=${invoice.tenantId!._id}&invoiceId=${invoice._id}`,
                          )
                        }
                      >
                        <CreditCard className="h-4 w-4" />
                        Record payment
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
                  {tenantPhone && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // PDF URL is auth-protected; share invoice summary only (not a naked PDF link)
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
                    Edit Invoice
                  </Button>
                </div>
              </DetailCard>

              {invoice.payments && invoice.payments.length > 0 && (
                <DetailCard title="Payment History" icon={<CreditCard />}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--border-color)]">
                          <th className="pb-3 text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                            Amount
                          </th>
                          <th className="pb-3 text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                            Method
                          </th>
                          <th className="pb-3 text-right text-[11px] font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--border-color)]">
                        {invoice.payments.map((p) => (
                          <tr
                            key={p._id}
                            className="cursor-pointer transition-colors hover:bg-[color:var(--color-field-bg)]"
                            onClick={() => router.push(`/payments/${p._id}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                router.push(`/payments/${p._id}`);
                              }
                            }}
                            tabIndex={0}
                            role="link"
                          >
                            <td className="py-3 font-bold text-[color:var(--color-brand-700)] tabular-nums">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="py-3 text-[color:var(--color-text-secondary)] capitalize">
                              {p.method.replace('_', ' ')}
                            </td>
                            <td className="py-3 text-right">
                              <StatusBadge
                                variant={statusToVariant(p.status)}
                                label={p.status.replace('_', ' ')}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DetailCard>
              )}

              {invoice.payments && invoice.payments.length > 0 && (
                <DetailCard title="Payment Timeline" icon={<CreditCard />}>
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

              <DetailCard title="Invoice meta" icon={<Hash />}>
                <DetailList>
                  <DetailRow label="Invoice #" value={invoice.invoiceNumber} />
                  <DetailRow label="Tenant" value={tenantName} />
                  <DetailRow label="Room" value={roomNumber} />
                  <DetailRow label="Floor" value={floorName} />
                  <DetailRow label="Created" value={formatDate(invoice.createdAt)} />
                </DetailList>
              </DetailCard>
            </div>
          </div>

          {invoice.updatedAt && (
            <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
              Last updated: {new Date(invoice.updatedAt).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      )}
    </FormPage>
  );
}
