'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import { tenantDisplayName, tenantRoomNumber } from '@/lib/api-shapes';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  invoiceId: z.string().min(1, 'Invoice is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  method: z.enum(['cash', 'bank_transfer', 'other']),
  paidAt: z.string().min(1, 'Paid at is required'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

type FormData = z.infer<typeof schema>;

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

interface InvoiceOption {
  _id: string;
  invoiceNumber: string;
  month: string;
  totalAmount: number;
  status: string;
  balance?: number;
  paidAmount?: number;
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

function NewPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillTenantId = searchParams.get('tenantId') ?? '';
  const prefillInvoiceId = searchParams.get('invoiceId') ?? '';

  const [submitError, setSubmitError] = useState('');
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<number | null>(null);

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
    setSelectedBalance(null);
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

  useEffect(() => {
    if (!invoiceId) {
      setSelectedBalance(null);
      return;
    }
    api
      .get(`invoices/${invoiceId}`)
      .json<{
        success: boolean;
        data: { balance?: number; totalAmount: number; paidAmount?: number };
      }>()
      .then((res) => {
        const balance = res.data.balance ?? res.data.totalAmount - (res.data.paidAmount ?? 0);
        setSelectedBalance(balance);
        setValue('amount', balance > 0 ? balance : 0);
      })
      .catch(() => setSelectedBalance(null));
  }, [invoiceId, setValue]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api
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
        .json<{ success: boolean }>();
      router.push('/payments');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to record offline payment. Check tenant, invoice, and amount.';
      setSubmitError(message);
    }
  };

  const invoiceOptions = invoices.map((inv) => ({
    value: inv._id,
    label: `${inv.invoiceNumber} · ${inv.month} · ₹${inv.totalAmount.toLocaleString('en-IN')} (${inv.status})`,
  }));

  return (
    <FormPage
      title="Record Offline Payment"
      description="Cash, bank transfer, or other methods linked to an invoice"
      backHref="/payments"
      error={submitError}
    >
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
        <div className="space-y-5">
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Tenant"
                endpoint="tenants"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select tenant..."
                error={errors.tenantId?.message}
                valueKey="_id"
                labelKey={(item) =>
                  `${tenantDisplayName(item as never)} — Room ${tenantRoomNumber(item as never)}`
                }
                sublabelFn={(item) => {
                  const rent = (item as { monthlyRent?: number }).monthlyRent;
                  return rent != null ? `₹${rent}/mo` : '';
                }}
              />
            )}
          />

          <Select
            label="Invoice"
            options={
              invoicesLoading
                ? [{ value: '', label: 'Loading invoices...' }]
                : invoiceOptions.length > 0
                  ? invoiceOptions
                  : [
                      {
                        value: '',
                        label: tenantId ? 'No payable invoices' : 'Select a tenant first',
                      },
                    ]
            }
            error={errors.invoiceId?.message}
            disabled={!tenantId || invoicesLoading || invoiceOptions.length === 0}
            {...register('invoiceId')}
          />

          {selectedBalance != null && (
            <p className="text-sm font-medium text-[color:var(--color-text-secondary)]">
              Remaining balance: ₹{selectedBalance.toLocaleString('en-IN')}
            </p>
          )}

          <FormGrid>
            <Input
              label="Amount (₹)"
              type="number"
              step="0.01"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <Select
              label="Payment Method"
              options={METHOD_OPTIONS}
              error={errors.method?.message}
              {...register('method')}
            />
          </FormGrid>

          <Input
            label="Paid At"
            type="datetime-local"
            error={errors.paidAt?.message}
            {...register('paidAt')}
          />

          <Textarea label="Notes" rows={3} placeholder="Optional notes..." {...register('notes')} />
        </div>
      </FormCard>
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
