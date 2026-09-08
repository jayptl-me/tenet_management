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
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
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
      // Loaded and invoice not payable / missing — do not retry forever.
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
      const balance =
        found.balance ?? Math.max(0, found.totalAmount - (found.paidAmount ?? 0));
      setValue('amount', balance > 0 ? balance : 0);
    }
  }, [invoiceId, invoices, setValue]);

  const balance = selectedInvoice
    ? (selectedInvoice.balance ?? Math.max(0, selectedInvoice.totalAmount - (selectedInvoice.paidAmount ?? 0)))
    : null;
  const overpay = balance != null && (Number(amount) || 0) > balance + 0.001;

  const quickAmounts = balance != null && balance > 0
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
      description="Cash, bank transfer, or other methods linked to an invoice"
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
            <FormSection
              title="Payer & invoice"
              icon={<UserRound />}
              description="Tenant and the open invoice being settled"
            >
              <Controller
                name="tenantId"
                control={control}
                render={({ field }) => (
                  <ResourceSelect
                    label="Tenant"
                    endpoint="tenants?isActive=true"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select tenant..."
                    error={err.tenantId?.message}
                    valueKey="_id"
                    labelKey={tenantLabel}
                    sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
                    dataPath="data"
                  />
                )}
              />
              <div className="mt-4">
                <label className="mb-1.5 block text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  Invoice
                </label>
                {invoicesLoading ? (
                  <div className={clsx(surfaceNestedClass, 'px-3 py-2.5 text-sm text-[color:var(--color-text-muted)]')}>
                    Loading invoices...
                  </div>
                ) : !tenantId ? (
                  <div className={clsx(surfaceNestedClass, 'flex items-center gap-2 px-3 py-2.5 text-sm text-[color:var(--color-text-muted)]')}>
                    <Info className="h-4 w-4" />
                    Select a tenant first
                  </div>
                ) : invoices.length === 0 ? (
                  <div className={clsx(surfaceNestedClass, 'px-3 py-2.5 text-sm text-[color:var(--color-text-muted)]')}>
                    No payable invoices for this tenant
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {invoices.map((inv) => {
                      const bal = inv.balance ?? Math.max(0, inv.totalAmount - (inv.paidAmount ?? 0));
                      const active = invoiceId === inv._id;
                      return (
                        <button
                          key={inv._id}
                          type="button"
                          onClick={() => setValue('invoiceId', inv._id, { shouldValidate: true })}
                          className={clsx(
                            'rounded-[var(--radius-lg)] border p-3 text-left transition-all',
                            active
                              ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] shadow-[var(--shadow-sm)]'
                              : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] hover:border-[color:var(--color-brand-300)]',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-[color:var(--color-text-primary)]">
                              {inv.invoiceNumber}
                            </span>
                            <StatusBadge
                              variant={statusToVariant(inv.status)}
                              label={inv.status.replace(/_/g, ' ')}
                            />
                          </div>
                          <div className="mt-1.5 flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
                              {inv.month}
                            </span>
                            <span className="text-sm font-bold text-[color:var(--color-text-primary)] tabular-nums">
                              {fmtMoney(bal)} due
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {err.invoiceId?.message && (
                  <p className="mt-1.5 text-[12px] font-medium text-[color:var(--color-danger-600)]" role="alert">
                    {err.invoiceId.message}
                  </p>
                )}
              </div>
            </FormSection>

            <FormSection
              title="Payment"
              icon={<Banknote />}
              description="Amount defaults to the invoice balance"
              divided
            >
              <FormGrid>
                <div>
                  <Input
                    label="Amount (₹)"
                    type="number"
                    step="0.01"
                    error={overpay ? `Amount exceeds remaining balance of ${fmtMoney(balance)}` : err.amount?.message}
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
                            'rounded-[var(--radius-full)] border px-2.5 py-1 text-[11px] font-bold transition-colors',
                            Number(amount) === q.value
                              ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]'
                              : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-brand-300)]',
                          )}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  label="Paid At"
                  type="datetime-local"
                  error={err.paidAt?.message}
                  {...register('paidAt')}
                />
              </FormGrid>

              <div className="mt-4">
                <label className="mb-1.5 block text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  Payment method
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
                          'flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] border p-3 transition-all',
                          active
                            ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] shadow-[var(--shadow-sm)]'
                            : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] hover:border-[color:var(--color-brand-300)]',
                        )}
                        aria-pressed={active}
                      >
                        <Icon
                          className={clsx(
                            'h-5 w-5',
                            active
                              ? 'text-[color:var(--color-brand-600)]'
                              : 'text-[color:var(--color-text-muted)]',
                          )}
                        />
                        <span
                          className={clsx(
                            'text-xs font-bold',
                            active
                              ? 'text-[color:var(--color-brand-800)]'
                              : 'text-[color:var(--color-text-primary)]',
                          )}
                        >
                          {m.label}
                        </span>
                        <span className="text-center text-[10px] font-medium text-[color:var(--color-text-muted)]">
                          {m.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {err.method?.message && (
                  <p className="mt-1.5 text-[12px] font-medium text-[color:var(--color-danger-600)]" role="alert">
                    {err.method.message}
                  </p>
                )}
              </div>
            </FormSection>

            <FormSection
              title="Notes"
              icon={<ReceiptText />}
              description="Optional remarks for the record"
              divided
            >
              <FormFullWidth>
                <Textarea label="Notes" rows={3} placeholder="Optional notes..." {...register('notes')} />
              </FormFullWidth>
            </FormSection>
          </FormCard>
        </div>

        {/* Summary rail */}
        <div className="space-y-4 xl:col-span-1">
          <div className={clsx(surfaceCardClass, 'sticky top-6 p-5')}>
            <h3 className="font-display text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Payment summary
            </h3>
            {selectedInvoice ? (
              <div className="mt-4 space-y-3">
                <div className={clsx(surfaceNestedClass, 'space-y-2 p-3.5 text-[13px]')}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[color:var(--color-text-muted)]">Invoice</span>
                    <span className="font-mono text-xs font-bold text-[color:var(--color-text-primary)]">
                      {selectedInvoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[color:var(--color-text-muted)]">Month</span>
                    <span className="font-semibold text-[color:var(--color-text-primary)]">
                      {selectedInvoice.month}
                    </span>
                  </div>
                  <div className="border-t border-[color:var(--border-color)] pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[color:var(--color-text-muted)]">Rent</span>
                      <span className="tabular-nums">{fmtMoney(selectedInvoice.rentAmount ?? 0)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-medium text-[color:var(--color-text-muted)]">Electricity</span>
                      <span className="tabular-nums">{fmtMoney(selectedInvoice.electricityAmount ?? 0)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-medium text-[color:var(--color-text-muted)]">Other</span>
                      <span className="tabular-nums">{fmtMoney(selectedInvoice.otherCharges ?? 0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[color:var(--border-color)] pt-2">
                    <span className="font-medium text-[color:var(--color-text-muted)]">Balance due</span>
                    <span className="font-display text-base font-bold text-[color:var(--color-danger-600)] tabular-nums">
                      {fmtMoney(balance)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[color:var(--color-success-200)] bg-[color:var(--color-success-50)] px-3.5 py-3">
                  <span className="text-[13px] font-semibold text-[color:var(--color-success-800)]">
                    Recording
                  </span>
                  <span className="font-display text-lg font-bold text-[color:var(--color-success-800)] tabular-nums">
                    {fmtMoney(Number(amount) || 0)}
                  </span>
                </div>
                <p className="flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-[color:var(--color-text-muted)]">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                  After saving, the invoice balance re-syncs automatically. Partial amounts leave the
                  rest as a pending obligation.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-[13px] font-medium text-[color:var(--color-text-muted)]">
                Select a tenant and invoice to see the balance breakdown here.
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
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <NewPaymentForm />
    </Suspense>
  );
}
