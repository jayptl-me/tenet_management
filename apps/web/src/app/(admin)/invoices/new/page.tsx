'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/useApiQuery';
import {
  UserRound,
  CalendarDays,
  Banknote,
  AlertTriangle,
  Plus,
  Trash2,
  FileText,
  Clock,
  Building2,
  Phone,
  CheckCircle2,
  Zap,
  Bell,
  Scale,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';
import { clsx } from 'clsx';

interface LineItemInput {
  id: string;
  description: string;
  amount: number;
}

interface PopulatedTenantDetail {
  _id: string;
  user?: { name?: string; phone?: string; email?: string };
  room?: { roomNumber?: string };
  monthlyRent?: number;
  securityDeposit?: number;
  status?: string;
}

/** The invoice that already exists for this resident and month. */
interface ExistingInvoice {
  _id: string;
  invoiceNumber?: string;
  status?: string;
  totalAmount?: number;
  dueDate?: string;
}

/** The money the resident owes across every open invoice. */
interface TenantDues {
  totalDue?: number;
  unpaidInvoices?: Array<{
    _id: string;
    invoiceNumber?: string;
    month?: string;
    remaining?: number | null;
    status?: string;
  }>;
  pendingPayments?: number;
}

interface ElectricityShareInfo {
  billId: string;
  month: string;
  status: string;
  roomNumber: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  ratePerUnit: number;
  roomTotalAmount: number;
  occupantCount: number;
  tenantShare: number;
}

/** A billing month is YYYY-MM. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const TENANT_KEY = (tenantId: string) => ['tenants', tenantId] as const;

const TENANT_DUES_KEY = (tenantId: string) => ['tenants', tenantId, 'dues'] as const;

const INVOICES_PREFIX = ['invoices'] as const;

const PAYMENTS_SUMMARY_PREFIX = ['payments', 'summary'] as const;

const DUPLICATE_INVOICE_KEY = (tenantId: string, month: string) =>
  ['invoices', 'duplicate-check', tenantId, month] as const;

const ELECTRICITY_SHARE_KEY = (tenantId: string, month: string) =>
  ['electricity', 'share', tenantId, month] as const;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonth(): string {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(): string {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function endOfMonthDate(): string {
  const d = new Date();
  const nextM = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return nextM.toISOString().slice(0, 10);
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const prefilledTenantId = searchParams.get('tenantId') ?? '';

  const [tenantId, setTenantId] = useState(prefilledTenantId);
  const [month, setMonth] = useState(currentMonth());
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Line items state
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);

  // Full tenant details for the selected resident (profile card + rent seed).
  const { data: tenantDetail = null } = useApiQuery<PopulatedTenantDetail>(
    TENANT_KEY(tenantId),
    `tenants/${tenantId}`,
    { enabled: Boolean(tenantId) },
  );

  // The invoice that already exists for this resident and this month.
  const { data: duplicateMatches, isPending: duplicatePending } = useApiQuery<ExistingInvoice[]>(
    DUPLICATE_INVOICE_KEY(tenantId, month),
    `invoices?tenantId=${tenantId}&month=${month}&limit=1`,
    { enabled: Boolean(tenantId) && MONTH_PATTERN.test(month) },
  );
  const duplicate = (duplicateMatches ?? [])[0] ?? null;

  // What the resident already owes, so a second bill is never issued blind.
  const { data: residentDues = null } = useApiQuery<TenantDues>(
    TENANT_DUES_KEY(tenantId),
    `tenants/${tenantId}/dues`,
    { enabled: Boolean(tenantId) },
  );
  const residentOpenInvoices =
    residentDues && Array.isArray(residentDues.unpaidInvoices) ? residentDues.unpaidInvoices : [];
  const residentTotalDue =
    residentDues && typeof residentDues.totalDue === 'number' ? residentDues.totalDue : null;
  const residentPendingPayments =
    residentDues && typeof residentDues.pendingPayments === 'number'
      ? residentDues.pendingPayments
      : null;

  // Electricity share for the selected tenant and billing month.
  const { data: elecShareData } = useApiQuery<ElectricityShareInfo | null>(
    ELECTRICITY_SHARE_KEY(tenantId, month),
    `electricity/share?tenantId=${tenantId}&month=${month}`,
    { enabled: Boolean(tenantId) && MONTH_PATTERN.test(month) },
  );

  const elecShare = elecShareData && elecShareData.tenantShare > 0 ? elecShareData : null;

  // Line items follow the selection: cleared when the tenant is cleared, seeded
  // from the resolved tenant's rent, and relabelled when the billing month
  // changes. Adjusted during render (state derived from previous renders)
  // instead of fetch effects.
  const [lineItemOwner, setLineItemOwner] = useState<{ tenantId: string; month: string } | null>(
    null,
  );
  if (!tenantId) {
    if (lineItemOwner !== null) {
      setLineItemOwner(null);
      setLineItems([]);
    }
  } else if (tenantDetail && lineItemOwner?.tenantId !== tenantId) {
    setLineItemOwner({ tenantId, month });
    // Seed the initial line item from monthlyRent when the tenant provides one.
    if (tenantDetail.monthlyRent && tenantDetail.monthlyRent > 0) {
      setLineItems([
        {
          id: 'item-rent-initial',
          description: `Room Rent (${month})`,
          amount: tenantDetail.monthlyRent,
        },
      ]);
    }
  } else if (lineItemOwner && lineItemOwner.month !== month) {
    setLineItemOwner({ tenantId, month });
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === 'item-rent-initial' ? { ...item, description: `Room Rent (${month})` } : item,
      ),
    );
  }

  const isElecAdded = lineItems.some((item) =>
    item.description.toLowerCase().includes('electricity'),
  );

  const addElectricityItem = () => {
    if (!elecShare) return;
    if (isElecAdded) {
      toast.info('Electricity charges already added to line items');
      return;
    }
    setLineItems((prev) => [
      ...prev,
      {
        id: `item-elec-${Date.now()}`,
        description: `Electricity Charges (${month})`,
        amount: elecShare.tenantShare,
      },
    ]);
    toast.info(`Added electricity share of ₹${elecShare.tenantShare.toLocaleString('en-IN')}`);
  };

  const monthChips = [
    { label: 'Last month', value: lastMonth() },
    { label: 'This month', value: currentMonth() },
    { label: 'Next month', value: nextMonth() },
  ];

  const dueDateChips = [
    { label: '+5 days', value: addDays(5) },
    { label: '+10 days', value: addDays(10) },
    { label: '+15 days', value: addDays(15) },
    { label: 'End of month', value: endOfMonthDate() },
  ];

  const addLineItem = (desc: string, amount: number = 0) => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        description: desc,
        amount,
      },
    ]);
  };

  const updateLineItem = (id: string, updates: Partial<LineItemInput>) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalInvoiceAmount = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // The office cannot issue a second bill for a month that already has one:
  // the server keeps one invoice per resident and month, so the write would be
  // refused by the database.
  const blockedByDuplicate = duplicate !== null;
  const submitBlocked =
    !tenantId || lineItems.length === 0 || blockedByDuplicate || duplicatePending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!tenantId) {
      setSubmitError('Please select a target tenant.');
      return;
    }
    if (!month || !MONTH_PATTERN.test(month)) {
      setSubmitError('Please provide a valid billing month (YYYY-MM).');
      return;
    }
    if (lineItems.length === 0) {
      setSubmitError('Please add at least one line item to the invoice.');
      return;
    }
    if (blockedByDuplicate) {
      setSubmitError(
        'An invoice already exists for this resident and month. Open it instead of issuing a second one.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tenantId,
        month,
        dueDate: dueDate || undefined,
        lineItems: lineItems.map((item) => ({
          description: item.description.trim(),
          amount: Number(item.amount) || 0,
        })),
      };

      const res = await api.post('invoices/generate-single', { json: payload }).json<{
        success: boolean;
        data?: { _id?: string; invoiceNumber?: string; status?: string };
      }>();

      // The invoice exists because the server wrote it. Re-read the invoice
      // lists and the dues summary, then open the record the server created.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: INVOICES_PREFIX }),
        queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_PREFIX }),
        queryClient.invalidateQueries({ queryKey: TENANT_DUES_KEY(tenantId) }),
      ]);
      const createdId = res.data?._id;
      router.push(createdId ? `/invoices/${createdId}` : '/invoices');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormPage
      title="Compose Invoice"
      description="Create an itemized billing invoice for rent, electricity, maintenance, or custom charges"
      backHref="/invoices"
      error={submitError}
      maxWidth="form"
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Main Column: Target & Line Items */}
          <div className="space-y-6 xl:col-span-2">
            {/* Target & Billing Cycle */}
            <div className={clsx(surfaceCardClass, 'p-6')}>
              <div className="flex items-center gap-2.5 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-(--radius-md) bg-(--color-brand-100) text-(--color-brand-600)">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-(--color-text-primary)">
                    Target & Period
                  </h3>
                  <p className="text-xs text-(--color-text-muted)">
                    Select the resident and the billing cycle
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <ResourceSelect
                    label="Tenant"
                    endpoint="tenants?isActive=true"
                    value={tenantId}
                    onChange={(val: string) => setTenantId(val)}
                    placeholder="Select an active tenant..."
                    valueKey="_id"
                    labelKey={tenantLabel}
                    sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
                    dataPath="data"
                  />
                </div>

                <div>
                  <Input
                    label="Billing Month"
                    placeholder="YYYY-MM"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    leftIcon={<CalendarDays className="h-4 w-4" />}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {monthChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setMonth(chip.value)}
                        className={clsx(
                          'text-2xs rounded-(--radius-full) border px-2.5 py-1 font-bold transition-colors',
                          month === chip.value
                            ? 'border-(--color-brand-500) bg-(--color-brand-100) text-(--color-brand-800)'
                            : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) hover:border-(--color-brand-300)',
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <DatePicker
                    label="Payment Due Date"
                    value={dueDate}
                    onChange={(val: string) => setDueDate(val)}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dueDateChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setDueDate(chip.value)}
                        className={clsx(
                          'text-2xs rounded-(--radius-full) border px-2.5 py-1 font-bold transition-colors',
                          dueDate === chip.value
                            ? 'border-(--color-brand-500) bg-(--color-brand-100) text-(--color-brand-800)'
                            : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) hover:border-(--color-brand-300)',
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* The duplicate is a wall, not a warning: the server keeps one
                  invoice per resident and month, so a second write for this
                  month is refused. */}
              {blockedByDuplicate && duplicate && (
                <div className="mt-4 flex items-start gap-2.5 rounded-(--radius-md) border border-(--color-danger-300) bg-(--color-danger-50) p-3 text-xs font-medium text-(--color-danger-900)">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--color-danger-600)" />
                  <div>
                    <p className="font-bold">This resident already has an invoice for {month}.</p>
                    <p className="mt-1">
                      The server keeps one invoice per resident and month, so a second one is
                      refused. Open the invoice below and edit it, or bill a different month.
                    </p>
                    <Link
                      href={`/invoices/${duplicate._id}`}
                      className="mt-1.5 inline-flex items-center gap-1 font-bold text-(--color-danger-800) underline underline-offset-2"
                    >
                      {duplicate.invoiceNumber ?? 'Open the existing invoice'}
                      {duplicate.status ? ` · ${duplicate.status.replace(/_/g, ' ')}` : ''}
                    </Link>
                  </div>
                </div>
              )}

              {/* What the resident already carries. A second bill on top of an
                  open one is a decision the office makes on purpose. */}
              {tenantId && residentOpenInvoices.length > 0 && (
                <div className="mt-4">
                  <p className="text-2xs tracking-label mb-1.5 font-bold text-(--color-text-muted) uppercase">
                    Already open for this resident
                  </p>
                  <div className="space-y-1.5">
                    {residentOpenInvoices.map((open) => (
                      <Link
                        key={open._id}
                        href={`/invoices/${open._id}`}
                        className="flex items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-color) px-2.5 py-1.5 text-xs font-semibold text-(--color-text-secondary) hover:border-(--color-brand-300)"
                      >
                        <span>
                          {open.invoiceNumber ?? open._id.slice(-6)}
                          {open.month ? ` · ${open.month}` : ''}
                          {open.status ? ` · ${open.status.replace(/_/g, ' ')}` : ''}
                        </span>
                        <span className="tabular-nums">
                          {typeof open.remaining === 'number'
                            ? `${fmtMoney(open.remaining)} due`
                            : 'balance not reported'}
                        </span>
                      </Link>
                    ))}
                  </div>
                  {residentTotalDue != null && (
                    <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                      The resident owes {fmtMoney(residentTotalDue)} in total across these invoices.
                      The number is the server&apos;s dues summary.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Line Items Builder */}
            <div className={clsx(surfaceCardClass, 'p-6')}>
              <div className="flex items-center justify-between pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-(--radius-md) bg-(--color-brand-100) text-(--color-brand-600)">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-(--color-text-primary)">
                      Itemized Charges
                    </h3>
                    <p className="text-xs text-(--color-text-muted)">
                      Itemize the charges of this invoice
                    </p>
                  </div>
                </div>

                {/* Quick Add Presets */}
                <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addLineItem(`Room Rent (${month})`, tenantDetail?.monthlyRent ?? 0)
                    }
                  >
                    + Rent
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={elecShare && !isElecAdded ? 'primary' : 'outline'}
                    onClick={() =>
                      addLineItem(`Electricity Charges (${month})`, elecShare?.tenantShare ?? 0)
                    }
                  >
                    {elecShare ? `+ Electricity (₹${elecShare.tenantShare})` : '+ Electricity'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addLineItem('Maintenance / Amenities Fee', 500)}
                  >
                    + Maintenance
                  </Button>
                </div>
              </div>

              {/* Mobile Presets */}
              <div className="flex flex-wrap gap-1.5 pb-4 sm:hidden">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    addLineItem(`Room Rent (${month})`, tenantDetail?.monthlyRent ?? 0)
                  }
                >
                  + Rent
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addLineItem(`Electricity (${month})`, elecShare?.tenantShare ?? 0)}
                >
                  {elecShare ? `+ Elec (₹${elecShare.tenantShare})` : '+ Electricity'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addLineItem('Maintenance Fee', 500)}
                >
                  + Maintenance
                </Button>
              </div>

              {elecShare && (
                <div className="mb-4 flex flex-col gap-3 rounded-(--radius-md) border border-(--color-brand-200) bg-(--color-brand-50) p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 shrink-0 text-(--color-brand-600)" />
                    <p className="text-xs font-semibold text-(--color-brand-900)">
                      Electricity bill for {month} is ready: {elecShare.unitsConsumed} units
                      consumed in Room {elecShare.roomNumber}. Tenant share is ₹
                      {elecShare.tenantShare.toLocaleString('en-IN')}.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isElecAdded ? 'outline' : 'primary'}
                    onClick={addElectricityItem}
                    disabled={isElecAdded}
                    className="shrink-0"
                  >
                    {isElecAdded ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Electricity Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Add Electricity Share
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Line Items Table/List */}
              <div className="space-y-3">
                {lineItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-(--radius-lg) border border-dashed border-(--border-color) py-8 text-center">
                    <FileText className="h-8 w-8 text-(--color-text-muted)" />
                    <p className="mt-2 text-xs font-semibold text-(--color-text-primary)">
                      No line items added yet
                    </p>
                    <p className="text-xs text-(--color-text-muted)">
                      Select a tenant above or add custom line items
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => addLineItem('Custom Charge', 1000)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Line Item
                    </Button>
                  </div>
                ) : (
                  lineItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className={clsx(
                        surfaceNestedClass,
                        'flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4',
                      )}
                    >
                      <span className="hidden w-5 text-center text-xs font-bold text-(--color-text-muted) sm:inline-block">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <input
                          type="text"
                          aria-label={`Item ${idx + 1} description`}
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                          placeholder="Description (e.g. Monthly Room Rent)"
                          className="w-full rounded-(--radius-md) border border-(--border-color) bg-(--color-surface) px-3 py-1.5 text-xs font-medium text-(--color-text-primary) focus:border-(--color-brand-500) focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative w-36">
                          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold text-(--color-text-muted)">
                            ₹
                          </span>
                          <input
                            type="number"
                            aria-label={`Item ${idx + 1} amount`}
                            value={item.amount}
                            onChange={(e) =>
                              updateLineItem(item.id, { amount: parseFloat(e.target.value) || 0 })
                            }
                            placeholder="0"
                            className="w-full rounded-(--radius-md) border border-(--border-color) bg-(--color-surface) py-1.5 pr-3 pl-7 text-right font-mono text-xs font-bold text-(--color-text-primary) focus:border-(--color-brand-500) focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete item ${idx + 1}`}
                          onClick={() => removeLineItem(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-(--radius-md) text-(--color-text-muted) transition-colors hover:bg-(--color-danger-50) hover:text-(--color-danger-600)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {lineItems.length > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-(--border-color) pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addLineItem('Custom Charge', 0)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </Button>
                  <div className="text-right">
                    <span className="text-xs font-medium text-(--color-text-muted)">
                      Subtotal ({lineItems.length} items):
                    </span>
                    <span className="ml-2 font-mono text-sm font-bold text-(--color-text-primary)">
                      {fmtMoney(totalInvoiceAmount)}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                The server accepts a non-negative amount on every line. A discount is applied by
                lowering the charge it belongs to, not by a negative line.
              </p>
            </div>
          </div>

          {/* Right Column: Resident Snapshot & Settlement Rail */}
          <div className="space-y-6">
            {/* Resident Snapshot */}
            <div className={clsx(surfaceCardClass, 'p-5')}>
              <div className="flex items-center gap-2 pb-3">
                <Building2 className="h-4 w-4 text-(--color-brand-500)" />
                <h4 className="font-display text-sm font-bold text-(--color-text-primary)">
                  Resident Profile
                </h4>
              </div>

              {tenantDetail ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <span className="block text-sm font-bold text-(--color-text-primary)">
                      {tenantDetail.user?.name ?? 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
                      <Phone className="h-3 w-3" />
                      {tenantDetail.user?.phone ?? 'No phone'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-sunken) p-3 text-xs">
                    <div>
                      <span className="text-2xs block text-(--color-text-muted)">
                        Assigned Room
                      </span>
                      <span className="font-bold text-(--color-text-primary)">
                        {tenantDetail.room?.roomNumber
                          ? `Room ${tenantDetail.room.roomNumber}`
                          : 'Unassigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs block text-(--color-text-muted)">Agreed Rent</span>
                      <span className="font-bold text-(--color-brand-600)">
                        {fmtMoney(tenantDetail.monthlyRent)}/mo
                      </span>
                    </div>
                  </div>

                  {tenantDetail.securityDeposit ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-(--color-text-muted)">Deposit Held:</span>
                      <span className="font-mono font-semibold text-(--color-text-primary)">
                        {fmtMoney(tenantDetail.securityDeposit)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-(--color-text-muted)">
                  Select a tenant to view agreed rent, room assignment, and contact details.
                </div>
              )}
            </div>

            {/* Live Invoice Breakdown */}
            <div className={clsx(surfaceCardClass, 'p-5')}>
              <div className="flex items-center gap-2 pb-3">
                <Banknote className="h-4 w-4 text-(--color-brand-500)" />
                <h4 className="font-display text-sm font-bold text-(--color-text-primary)">
                  Invoice Summary
                </h4>
              </div>

              <div className="space-y-2.5 pt-1 text-xs">
                <div className="flex justify-between text-(--color-text-secondary)">
                  <span>Billing Period</span>
                  <span className="font-semibold text-(--color-text-primary)">{month}</span>
                </div>
                <div className="flex justify-between text-(--color-text-secondary)">
                  <span>Due Date</span>
                  <span className="font-semibold text-(--color-text-primary)">
                    {dueDate || '5th of the billing month'}
                  </span>
                </div>
                <div className="flex justify-between text-(--color-text-secondary)">
                  <span>Line Items</span>
                  <span className="font-semibold text-(--color-text-primary)">
                    {lineItems.length}
                  </span>
                </div>

                <div className="border-t border-(--border-color) pt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-sm font-bold text-(--color-text-primary)">
                      Resident is charged
                    </span>
                    <span className="font-display text-2xl font-extrabold text-(--color-brand-600) tabular-nums">
                      {fmtMoney(totalInvoiceAmount)}
                    </span>
                  </div>
                  <p className="text-2xs mt-1 flex items-center gap-1 text-(--color-text-muted)">
                    <Clock className="h-3 w-3" />
                    The server adds the line items up and splits them into rent, electricity and
                    other charges by the wording of the description.
                  </p>
                </div>
              </div>

              {/* What the write does, said before it happens. */}
              <div className="text-2xs mt-4 space-y-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-sunken) p-3 font-medium text-(--color-text-secondary)">
                <p className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-(--color-success-600)" />
                  The server issues the invoice as <strong>sent</strong>, not as a draft.
                </p>
                <p className="flex items-start gap-1.5">
                  <Scale className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                  It opens one pending UPI obligation of {fmtMoney(totalInvoiceAmount)} for the
                  resident.
                </p>
                <p className="flex items-start gap-1.5">
                  <Bell className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                  It notifies the resident with the invoice number, the amount and the due date.
                </p>
                {residentPendingPayments ? (
                  <p className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-(--color-warning-600)" />
                    The resident already carries {residentPendingPayments} open payment
                    obligation(s).
                  </p>
                ) : null}
              </div>

              <div className="mt-5 space-y-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  loading={isSubmitting}
                  disabled={submitBlocked}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {blockedByDuplicate
                    ? 'Invoice already exists'
                    : `Issue Invoice · ${fmtMoney(totalInvoiceAmount)}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  disabled={isSubmitting}
                  onClick={() => router.push('/invoices')}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FormPage>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <FormPage
          title="Compose Invoice"
          description="Create an itemized billing invoice for rent, electricity, maintenance, or custom charges"
          backHref="/invoices"
          isLoading
          maxWidth="form"
        >
          {null}
        </FormPage>
      }
    >
      <NewInvoiceForm />
    </Suspense>
  );
}
