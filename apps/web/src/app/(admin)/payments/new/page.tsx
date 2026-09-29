'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserRound,
  ReceiptText,
  Banknote,
  Wallet,
  Landmark,
  Smartphone,
  CircleDollarSign,
  Info,
  ArrowRight,
  Home,
  FilePlus2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';
import { clsx } from 'clsx';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  invoiceId: z.string().min(1, 'Invoice is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  method: z.enum(['cash', 'bank_transfer', 'other', 'upi']),
  paidAt: z.string().min(1, 'Paid at is required'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

type FormData = z.infer<typeof schema>;

const METHODS = [
  { value: 'cash', label: 'Cash', icon: Wallet, hint: 'Counter collection' },
  { value: 'upi', label: 'UPI', icon: Smartphone, hint: 'UPI / QR payment' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark, hint: 'NEFT / IMPS / RTGS' },
  { value: 'other', label: 'Other', icon: CircleDollarSign, hint: 'Cheque, etc.' },
] as const;

interface InvoiceOption {
  _id: string;
  invoiceNumber: string;
  month: string;
  totalAmount: number;
  status: string;
  balance?: number;
  paidAmount?: number;
  rentAmount?: number;
  electricityAmount?: number;
  otherCharges?: number;
}

interface TenantProfile {
  _id: string;
  user?: { name: string; email?: string; phone?: string };
  room?: { roomNumber: string; floor?: { label?: string; floorNumber?: number } };
  bedId: string;
  monthlyRent: number;
  depositPaid: number;
  moveInDate?: string;
  isActive: boolean;
}

interface TenantDuesData {
  totalDue: number;
  depositHeld: number;
  unpaidInvoices?: Array<{
    _id: string;
    invoiceNumber: string;
    totalAmount: number;
    remaining?: number;
  }>;
}

function toIsoFromLocal(datetimeLocal: string): string {
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

function NewPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTenantId = searchParams.get('tenantId') ?? '';
  const prefillInvoiceId = searchParams.get('invoiceId') ?? '';

  const [submitError, setSubmitError] = useState('');
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceOption | null>(null);

  // Tenant overview state
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null);
  const [tenantDues, setTenantDues] = useState<TenantDuesData | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);

  // Skip clearing invoiceId on the first tenant-driven load when deep-linking with prefs.
  const skipInvoiceClearOnce = useRef(Boolean(prefillTenantId));
  const invoicePrefillApplied = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: prefillTenantId,
      invoiceId: '',
      amount: 0,
      method: 'cash',
      paidAt: nowLocalDatetime(),
      notes: '',
    },
  });

  const tenantId = useWatch({ control, name: 'tenantId' });
  const invoiceId = useWatch({ control, name: 'invoiceId' });
  const amount = useWatch({ control, name: 'amount' });
  const method = useWatch({ control, name: 'method' });

  // Load tenant profile & dues for smart overview
  useEffect(() => {
    if (!tenantId) {
      setTenantProfile(null);
      setTenantDues(null);
      return;
    }
    setTenantLoading(true);
    Promise.all([
      api
        .get(`tenants/${tenantId}`)
        .json<{ success: boolean; data: TenantProfile }>()
        .catch(() => null),
      api
        .get(`tenants/${tenantId}/dues`)
        .json<{ success: boolean; data: TenantDuesData }>()
        .catch(() => null),
    ])
      .then(([pRes, dRes]) => {
        if (pRes?.data) setTenantProfile(pRes.data);
        if (dRes?.data) setTenantDues(dRes.data);
      })
      .finally(() => setTenantLoading(false));
  }, [tenantId]);

  const loadInvoices = useCallback(async (tid: string) => {
    if (!tid) {
      setInvoices([]);
      return;
    }
    setInvoicesLoading(true);
    try {
      const res = await api
        .get(`invoices?tenantId=${tid}&limit=50&sort=month&order=desc`)
        .json<{ success: boolean; data: InvoiceOption[] }>();
      const payable = (res.data ?? []).filter((inv) =>
        ['draft', 'sent', 'partial', 'overdue'].includes(inv.status),
      );
      setInvoices(payable);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipInvoiceClearOnce.current) {
      skipInvoiceClearOnce.current = false;
    } else {
      setValue('invoiceId', '');
    }
    setSelectedInvoice(null);
    void loadInvoices(tenantId);
  }, [tenantId, loadInvoices, setValue]);

  // Apply optional invoiceId prefill once payable invoices are loaded.
  useEffect(() => {
    if (invoicePrefillApplied.current || !prefillInvoiceId || invoicesLoading) return;
    if (!tenantId || (prefillTenantId && tenantId !== prefillTenantId)) return;
    if (invoices.some((inv) => inv._id === prefillInvoiceId)) {
      setValue('invoiceId', prefillInvoiceId);
      invoicePrefillApplied.current = true;
    } else if (tenantId) {
      // Loaded and invoice not payable / missing - do not retry forever.
      invoicePrefillApplied.current = true;
    }
  }, [invoices, invoicesLoading, prefillInvoiceId, prefillTenantId, tenantId, setValue]);

  // Resolve the selected invoice object for the context card
  useEffect(() => {
    if (!invoiceId) {
      setSelectedInvoice(null);
      return;
    }
    const found = invoices.find((inv) => inv._id === invoiceId);
    setSelectedInvoice(found ?? null);
    if (found) {
      const bal = found.balance ?? Math.max(0, found.totalAmount - (found.paidAmount ?? 0));
      setValue('amount', bal > 0 ? bal : 0);
    }
  }, [invoiceId, invoices, setValue]);

  const balance = selectedInvoice
    ? (selectedInvoice.balance ??
      Math.max(0, selectedInvoice.totalAmount - (selectedInvoice.paidAmount ?? 0)))
    : null;
  const overpay = balance != null && (Number(amount) || 0) > balance + 0.001;
  const remainingAfter = balance != null ? Math.max(0, balance - (Number(amount) || 0)) : 0;

  const quickAmounts =
    balance != null && balance > 0
      ? [
          { label: 'Full balance', value: balance },
          { label: '50%', value: Math.round((balance / 2) * 100) / 100 },
          { label: '₹1,000', value: 1000 },
          { label: '₹5,000', value: 5000 },
        ].filter((q) => q.value > 0 && q.value <= balance)
      : [];

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const res = await api
        .post('payments/offline', {
          json: {
            tenantId: data.tenantId,
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method,
            paidAt: toIsoFromLocal(data.paidAt),
            notes: data.notes || undefined,
          },
        })
        .json<{ success: boolean; data?: { _id?: string } }>();
      const createdId = res.data?._id;
      router.push(createdId ? `/payments/${createdId}` : '/payments');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Record Offline Payment"
      description="Cash, bank transfer, or offline UPI collection linked to an invoice"
      backHref="/payments"
      error={submitError}
      maxWidth="5xl"
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FormCard
            onSubmit={handleSubmit(onSubmit)}
            footer={
              <FormActions
                loading={isSubmitting}
                cancelHref="/payments"
                submitLabel="Record Payment"
                divided={false}
              />
            }
          >
            {/* Section 1: Tenant & Financial Summary */}
            <FormSection
              title="Tenant & Obligation"
              icon={<UserRound />}
              description="Select the resident and the payable invoice being settled"
            >
              <Controller
                name="tenantId"
                control={control}
                render={({ field }) => (
                  <ResourceSelect
                    label="Resident"
                    endpoint="tenants?isActive=true"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search tenant by name or room..."
                    error={err.tenantId?.message}
                    valueKey="_id"
                    labelKey={tenantLabel}
                    sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
                    dataPath="data"
                  />
                )}
              />

              {/* Intelligent Tenant Context Strip */}
              {tenantLoading ? (
                <div
                  className={clsx(
                    surfaceNestedClass,
                    'mt-3 animate-pulse rounded-(--radius-lg) p-4 text-xs font-medium text-(--color-text-muted)',
                  )}
                >
                  Loading resident financial profile and balance...
                </div>
              ) : tenantProfile ? (
                <div
                  className={clsx(surfaceNestedClass, 'mt-3 space-y-2 rounded-(--radius-lg) p-4')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--border-color) pb-2.5">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-(--color-brand-600)" />
                      <span className="text-xs font-bold text-(--color-text-primary)">
                        Room {tenantProfile.room?.roomNumber ?? 'N/A'}
                        {tenantProfile.room?.floor?.label
                          ? ` (${tenantProfile.room.floor.label})`
                          : ''}{' '}
                        · Bed {tenantProfile.bedId}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-(--color-text-muted)">
                      Rent:{' '}
                      <strong className="text-(--color-text-primary)">
                        {fmtMoney(tenantProfile.monthlyRent)}/mo
                      </strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-2xs block text-(--color-text-muted)">Deposit Held</span>
                      <span className="font-bold text-(--color-text-primary) tabular-nums">
                        {fmtMoney(tenantProfile.depositPaid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs block text-(--color-text-muted)">
                        Total Unpaid Dues
                      </span>
                      <span
                        className={clsx(
                          'font-bold tabular-nums',
                          (tenantDues?.totalDue ?? 0) > 0
                            ? 'text-(--color-danger-600)'
                            : 'text-(--color-success-600)',
                        )}
                      >
                        {fmtMoney(tenantDues?.totalDue ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs block text-(--color-text-muted)">
                        Unpaid Invoices
                      </span>
                      <span className="font-bold text-(--color-text-primary)">
                        {tenantDues?.unpaidInvoices?.length ?? invoices.length} open
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Invoice selection */}
              <div className="mt-5">
                <label className="text-13 mb-1.5 block font-semibold text-(--color-text-primary)">
                  Select Payable Invoice
                </label>
                {invoicesLoading ? (
                  <div
                    className={clsx(
                      surfaceNestedClass,
                      'rounded-(--radius-lg) p-4 text-center text-xs font-medium text-(--color-text-muted)',
                    )}
                  >
                    Loading payable invoices...
                  </div>
                ) : !tenantId ? (
                  <div
                    className={clsx(
                      surfaceNestedClass,
                      'flex items-center gap-2 rounded-(--radius-lg) p-4 text-xs font-medium text-(--color-text-muted)',
                    )}
                  >
                    <Info className="h-4 w-4 shrink-0 text-(--color-brand-600)" />
                    Select a resident above to inspect payable invoices.
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="space-y-2 rounded-(--radius-lg) border border-(--color-brand-300) bg-(--color-brand-50) p-4 text-xs">
                    <p className="font-bold text-(--color-brand-900)">
                      No unpaid invoices found for this resident.
                    </p>
                    <p className="leading-relaxed text-(--color-brand-700)">
                      All existing invoices are settled. If you need to collect for this month or
                      extra charges, generate a new invoice first.
                    </p>
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => router.push(`/invoices/new?tenantId=${tenantId}`)}
                      >
                        <FilePlus2 className="mr-1 h-3.5 w-3.5" />
                        Generate New Invoice
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {invoices.map((inv) => {
                      const bal =
                        inv.balance ?? Math.max(0, inv.totalAmount - (inv.paidAmount ?? 0));
                      const active = invoiceId === inv._id;
                      return (
                        <button
                          key={inv._id}
                          type="button"
                          onClick={() => setValue('invoiceId', inv._id, { shouldValidate: true })}
                          className={clsx(
                            'relative overflow-hidden rounded-(--radius-lg) border p-3.5 text-left transition-all',
                            active
                              ? 'border-(--color-brand-600) bg-(--color-brand-50) shadow-(--shadow-sm)'
                              : 'border-(--border-color) bg-(--color-card-bg) hover:border-(--color-brand-300)',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-(--color-text-primary)">
                              {inv.invoiceNumber}
                            </span>
                            <StatusBadge
                              variant={statusToVariant(inv.status)}
                              label={inv.status.replace(/_/g, ' ')}
                            />
                          </div>
                          <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-(--border-color) pt-2">
                            <span className="text-xs font-medium text-(--color-text-muted)">
                              {inv.month}
                            </span>
                            <span className="text-sm font-bold text-(--color-danger-700) tabular-nums">
                              {fmtMoney(bal)} due
                            </span>
                          </div>
                          <div className="text-2xs mt-1 flex items-center justify-between text-(--color-text-muted)">
                            <span>Total: {fmtMoney(inv.totalAmount)}</span>
                            {inv.paidAmount ? <span>Paid: {fmtMoney(inv.paidAmount)}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {err.invoiceId?.message && (
                  <p className="text-12 mt-1.5 font-medium text-(--color-danger-600)" role="alert">
                    {err.invoiceId.message}
                  </p>
                )}
              </div>
            </FormSection>

            {/* Section 2: Settlement Details */}
            <FormSection
              title="Settlement Details"
              icon={<Banknote />}
              description="Specify the collected amount and payment method"
              divided
            >
              <FormGrid>
                <div>
                  <Input
                    label="Collected Amount (₹)"
                    type="number"
                    step="0.01"
                    error={
                      overpay
                        ? `Amount exceeds remaining balance of ${fmtMoney(balance)}`
                        : err.amount?.message
                    }
                    leftIcon={<Banknote className="h-4 w-4" />}
                    {...register('amount')}
                  />
                  {quickAmounts.length > 0 && !overpay && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {quickAmounts.map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => setValue('amount', q.value, { shouldValidate: true })}
                          className={clsx(
                            'text-2xs rounded-full border px-2.5 py-0.5 font-bold transition-colors',
                            Number(amount) === q.value
                              ? 'border-(--color-brand-500) bg-(--color-brand-100) text-(--color-brand-900)'
                              : 'border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) hover:border-(--color-brand-300)',
                          )}
                        >
                          {q.label} ({fmtMoney(q.value)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Input
                  label="Payment Date & Time"
                  type="datetime-local"
                  error={err.paidAt?.message}
                  {...register('paidAt')}
                />
              </FormGrid>

              <div className="mt-4">
                <label className="text-13 mb-1.5 block font-semibold text-(--color-text-primary)">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = method === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setValue('method', m.value, { shouldValidate: true })}
                        className={clsx(
                          'flex flex-col items-center gap-1.5 rounded-(--radius-lg) border p-3 transition-all',
                          active
                            ? 'border-(--color-brand-600) bg-(--color-brand-50) shadow-(--shadow-sm)'
                            : 'border-(--border-color) bg-(--color-card-bg) hover:border-(--color-brand-300)',
                        )}
                        aria-pressed={active}
                      >
                        <Icon
                          className={clsx(
                            'h-5 w-5',
                            active ? 'text-(--color-brand-600)' : 'text-(--color-text-muted)',
                          )}
                        />
                        <span
                          className={clsx(
                            'text-xs font-bold',
                            active ? 'text-(--color-brand-900)' : 'text-(--color-text-primary)',
                          )}
                        >
                          {m.label}
                        </span>
                        <span className="text-3xs text-center font-medium text-(--color-text-muted)">
                          {m.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {err.method?.message && (
                  <p className="text-12 mt-1.5 font-medium text-(--color-danger-600)" role="alert">
                    {err.method.message}
                  </p>
                )}
              </div>
            </FormSection>

            {/* Section 3: Notes */}
            <FormSection
              title="Audit & Remarks"
              icon={<ReceiptText />}
              description="Optional remarks, cheque/counter references"
              divided
            >
              <FormFullWidth>
                <Textarea
                  label="Internal Notes"
                  rows={2}
                  placeholder="e.g., Paid via counter cash, verified against bank passbook..."
                  {...register('notes')}
                />
              </FormFullWidth>
            </FormSection>
          </FormCard>
        </div>

        {/* Live Reconciliation Rail */}
        <div className="space-y-4 xl:col-span-1">
          <div className={clsx(surfaceCardClass, 'sticky top-6 p-5')}>
            <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
              Reconciliation Preview
            </h3>

            {selectedInvoice ? (
              <div className="mt-4 space-y-3.5">
                <div
                  className={clsx(
                    surfaceNestedClass,
                    'text-13 space-y-2 rounded-(--radius-lg) p-3.5',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-(--color-text-muted)">Target Invoice</span>
                    <span className="font-mono text-xs font-bold text-(--color-brand-700)">
                      {selectedInvoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-(--color-text-muted)">Billing Month</span>
                    <span className="font-semibold text-(--color-text-primary)">
                      {selectedInvoice.month}
                    </span>
                  </div>
                  <div className="space-y-1 border-t border-(--border-color) pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-(--color-text-muted)">Invoice Total</span>
                      <span className="tabular-nums">{fmtMoney(selectedInvoice.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-(--color-text-muted)">Already Paid</span>
                      <span className="tabular-nums">
                        {fmtMoney(selectedInvoice.paidAmount ?? 0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-(--border-color) pt-2">
                    <span className="font-semibold text-(--color-text-muted)">Balance Before</span>
                    <span className="font-display text-base font-bold text-(--color-danger-700) tabular-nums">
                      {fmtMoney(balance)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 rounded-(--radius-lg) border border-(--color-success-200) bg-(--color-success-50) p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-(--color-success-800)">
                      This Payment
                    </span>
                    <span className="font-display text-lg font-bold text-(--color-success-800) tabular-nums">
                      {fmtMoney(Number(amount) || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-(--color-success-200) pt-1 text-xs">
                    <span className="text-(--color-success-700)">Balance After</span>
                    <span className="font-bold text-(--color-success-900) tabular-nums">
                      {remainingAfter === 0 ? 'Zero Balance (Settled)' : fmtMoney(remainingAfter)}
                    </span>
                  </div>
                </div>

                <p className="text-2xs flex items-start gap-1.5 leading-relaxed font-medium text-(--color-text-muted)">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                  Saving will record the payment and update the invoice status to{' '}
                  {remainingAfter === 0 ? '"paid"' : '"partial"'}.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed font-medium text-(--color-text-muted)">
                Select a resident and payable invoice to view live settlement impact.
              </p>
            )}
          </div>
        </div>
      </div>
    </FormPage>
  );
}

export default function NewPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <NewPaymentForm />
    </Suspense>
  );
}
