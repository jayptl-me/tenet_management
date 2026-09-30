'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
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

const TENANT_KEY = (tenantId: string) => ['tenants', tenantId] as const;

const DUPLICATE_INVOICE_KEY = (tenantId: string, month: string) =>
  ['invoices', 'duplicate-check', tenantId, month] as const;

const ELECTRICITY_SHARE_KEY = (tenantId: string, month: string) =>
  ['electricity', 'share', tenantId, month] as const;

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Duplicate-invoice check for the selected tenant and billing month.
  const { data: duplicateMatches } = useApiQuery<Array<{ invoiceNumber?: string; status?: string }>>(
    DUPLICATE_INVOICE_KEY(tenantId, month),
    `invoices?tenantId=${tenantId}&month=${month}&limit=1`,
    { enabled: Boolean(tenantId) && /^\d{4}-\d{2}$/.test(month) },
  );

  // Electricity share for the selected tenant and billing month.
  const { data: elecShareData } = useApiQuery<ElectricityShareInfo | null>(
    ELECTRICITY_SHARE_KEY(tenantId, month),
    `electricity/share?tenantId=${tenantId}&month=${month}`,
    { enabled: Boolean(tenantId) && /^\d{4}-\d{2}$/.test(month) },
  );

  const duplicateMatch = (duplicateMatches ?? [])[0];
  const duplicateWarning = duplicateMatch
    ? `An invoice${duplicateMatch.invoiceNumber ? ` (${duplicateMatch.invoiceNumber})` : ''} already exists for this tenant and month${duplicateMatch.status ? ` (Status: ${duplicateMatch.status.replace(/_/g, ' ')})` : ''}. Generating a new one will create a separate invoice record.`
    : '';

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
        item.id === 'item-rent-initial'
          ? { ...item, description: `Room Rent (${month})` }
          : item,
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
    toast.success(`Added electricity share of ₹${elecShare.tenantShare.toLocaleString('en-IN')}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!tenantId) {
      setSubmitError('Please select a target tenant.');
      return;
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      setSubmitError('Please provide a valid billing month (YYYY-MM).');
      return;
    }
    if (lineItems.length === 0) {
      setSubmitError('Please add at least one line item to the invoice.');
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

      const res = await api
        .post('invoices/generate-single', { json: payload })
        .json<{ success: boolean; data?: { _id?: string; invoiceNumber?: string } }>();

      toast.success(
        `Invoice ${res.data?.invoiceNumber ? `#${res.data.invoiceNumber} ` : ''}generated successfully.`,
      );
      const createdId = res.data?._id;
      router.push(createdId ? `/invoices/${createdId}` : '/invoices');
    } catch (err) {
      const parsed = await parseApiError(err);
      setSubmitError(parsed.message || 'Failed to generate invoice.');
      toast.error(parsed.message || 'Failed to generate invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compose Invoice"
        description="Create an itemized billing invoice for rent, electricity, maintenance, or custom charges"
        backHref="/invoices"
      />

      <ErrorBanner message={submitError} />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Column: Target & Line Items */}
          <div className="space-y-6 lg:col-span-2">
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

              {duplicateWarning && (
                <div className="mt-4 flex items-start gap-2.5 rounded-(--radius-md) border border-(--color-warning-300) bg-(--color-warning-50) p-3 text-xs font-medium text-(--color-warning-900)">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--color-warning-600)" />
                  <span>{duplicateWarning}</span>
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
                      Itemized Charges & Adjustments
                    </h3>
                    <p className="text-xs text-(--color-text-muted)">
                      Itemize charges or discounts for this invoice
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addLineItem('Discount / Adjustment', -500)}
                  >
                    - Discount
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
                    {dueDate || 'Immediate'}
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
                      Total Payable
                    </span>
                    <span className="font-display text-2xl font-extrabold text-(--color-brand-600) tabular-nums">
                      {fmtMoney(totalInvoiceAmount)}
                    </span>
                  </div>
                  <p className="text-2xs mt-1 flex items-center gap-1 text-(--color-text-muted)">
                    <Clock className="h-3 w-3" />
                    Invoice will be issued in Draft status.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center"
                  loading={isSubmitting}
                  disabled={!tenantId || lineItems.length === 0}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Generate Invoice · {fmtMoney(totalInvoiceAmount)}
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
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <NewInvoiceForm />
    </Suspense>
  );
}
