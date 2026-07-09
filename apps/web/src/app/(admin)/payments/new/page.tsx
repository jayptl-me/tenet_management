'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { tenantDisplayName, tenantRoomNumber } from '@/lib/api-shapes';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  invoiceId: z.string().min(1, 'Invoice is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  method: z.enum(['cash', 'bank_transfer', 'other']),
  paidAt: z.string().min(1, 'Paid at is required'),
  notes: z.string().optional(),
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

export default function NewPaymentPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<number | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: '',
      invoiceId: '',
      amount: 0,
      method: 'cash',
      paidAt: nowLocalDatetime(),
      notes: '',
    },
  });

  const tenantId = watch('tenantId');
  const invoiceId = watch('invoiceId');

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
    setValue('invoiceId', '');
    setSelectedBalance(null);
    void loadInvoices(tenantId);
  }, [tenantId, loadInvoices, setValue]);

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
        const balance =
          res.data.balance ??
          res.data.totalAmount - (res.data.paidAmount ?? 0);
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
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
            Record Offline Payment
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            Cash, bank transfer, or other methods linked to an invoice
          </p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
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
                labelKey={(item: { user?: { name?: string }; room?: { roomNumber?: string }; monthlyRent?: number }) =>
                  `${tenantDisplayName(item as never)} — Room ${tenantRoomNumber(item as never)}`
                }
                sublabelFn={(item: { monthlyRent?: number }) =>
                  item.monthlyRent != null ? `₹${item.monthlyRent}/mo` : ''
                }
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
                  : [{ value: '', label: tenantId ? 'No payable invoices' : 'Select a tenant first' }]
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

          <Input
            label="Paid At"
            type="datetime-local"
            error={errors.paidAt?.message}
            {...register('paidAt')}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="notes"
              className="text-sm font-semibold text-[color:var(--color-text-primary)]"
            >
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-4 py-2.5 text-base text-[color:var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-500)]"
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>
        </div>
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </form>
    </div>
  );
}
