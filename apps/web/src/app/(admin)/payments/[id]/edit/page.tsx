'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, User, Home, Hash, Receipt, Lock, History } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';
import { useUnsavedGuardState } from '@/hooks/useUnsavedGuard';
import { clsx } from 'clsx';

const schema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.enum(['upi', 'cash', 'bank_transfer', 'other']),
  type: z.enum(['rent', 'electricity', 'deposit', 'laundry', 'other']),
  // 'paid' is intentionally absent: marking paid must go through the verify
  // flow so verifiedBy/paidAt stay truthful (API rejects paid via PUT).
  status: z.enum(['pending', 'pending_verification', 'overdue', 'cancelled']),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

type FormData = z.infer<typeof schema>;

interface PaymentContext {
  _id?: string;
  status: string;
  amount?: number;
  method?: string;
  type?: string;
  notes?: string;
  utrNumber?: string;
  paidAt?: string;
  createdAt?: string;
  tenantId?:
    | string
    | {
        _id?: string;
        userId?: { name?: string };
        roomId?: { _id?: string; roomNumber?: string };
      };
  invoiceId?: string | { _id?: string; invoiceNumber?: string; month?: string };
}

/** The money of the linked invoice, as the server computes it (GET /invoices/:id). */
interface InvoiceMoney {
  _id: string;
  invoiceNumber?: string;
  month?: string;
  status?: string;
  totalAmount?: number;
  /** The settled sum of the paid rows. */
  paidAmount?: number;
  /** The amount still due; null when the server did not report one. */
  balance?: number | null;
}

const STATUS_HELP: Record<string, string> = {
  pending: 'Awaiting payment from the tenant.',
  pending_verification: 'UTR submitted — verify on the detail page to mark paid.',
  overdue: 'Past due date and unpaid.',
  cancelled: 'Cancelled — excluded from balances and summaries.',
};

const PAYMENT_KEY = (id: string) => ['payments', id] as const;

const PAYMENT_EVENTS_KEY = (id: string) => ['payments', id, 'audit-logs'] as const;

/** The money of one invoice, read from the server. */
const INVOICE_MONEY_KEY = (invoiceId: string) => ['invoices', invoiceId, 'money'] as const;

const INVOICES_PREFIX = ['invoices'] as const;

const PAYMENTS_PREFIX = ['payments'] as const;

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function EditPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [submitError, setSubmitError] = useState('');
  const [isPaidLocked, setIsPaidLocked] = useState(false);
  const [initial, setInitial] = useState<Partial<FormData>>({});

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // The payment is read through the shared query stack, like every other
  // record: the load participates in the cache and a write invalidates it.
  const {
    data: context = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<PaymentContext>(PAYMENT_KEY(id), `payments/${id}`, { enabled: Boolean(id) });

  // The id whose values are already in the form. A refetch of the same record
  // must never wipe what the operator is typing.
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!context || loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    // API can still return legacy paid rows (now locked); coerce into a
    // valid enum value for the form while preserving the locked banner.
    const rawStatus = context.status ?? '';
    const values: FormData = {
      amount: context.amount ?? 0,
      method: (context.method ?? 'cash') as FormData['method'],
      type: (context.type ?? 'rent') as FormData['type'],
      status: (rawStatus === 'paid' ? 'pending' : rawStatus) as FormData['status'],
      notes: context.notes ?? '',
    };
    reset(values);
    setInitial(values);
    setIsPaidLocked(rawStatus === 'paid');
  }, [context, id, reset]);

  const watched = useWatch({ control });
  const isDirty = useMemo(() => {
    if (!initial.amount && initial.amount !== 0) return false;
    return (
      Number(watched.amount) !== Number(initial.amount) ||
      watched.method !== initial.method ||
      watched.type !== initial.type ||
      watched.status !== initial.status ||
      (watched.notes ?? '') !== (initial.notes ?? '')
    );
  }, [watched, initial]);

  const guard = useUnsavedGuardState(isDirty && !isPaidLocked && !isSubmitting);

  const tenant = context?.tenantId;
  const tenantId = typeof tenant === 'string' ? tenant : (tenant?._id ?? '');
  const tenantName = typeof tenant === 'object' ? (tenant?.userId?.name ?? 'Tenant') : 'Tenant';
  const roomNumber = typeof tenant === 'object' ? (tenant?.roomId?.roomNumber ?? null) : null;
  const roomId = typeof tenant === 'object' ? (tenant?.roomId?._id ?? '') : '';
  const invoice = context?.invoiceId;
  const invoiceHref = typeof invoice === 'string' ? invoice : (invoice?._id ?? '');
  const invoiceLabel =
    typeof invoice === 'object'
      ? (invoice?.invoiceNumber ?? invoiceHref) + (invoice?.month ? ` · ${invoice.month}` : '')
      : invoiceHref;

  // The money of the invoice this payment settles, from the server. The rail
  // shows the balance the server reports and what this amount would leave of
  // it, so an amount change is judged against a number nobody typed.
  const { data: invoiceMoney = null } = useApiQuery<InvoiceMoney>(
    INVOICE_MONEY_KEY(invoiceHref),
    `invoices/${invoiceHref}`,
    { enabled: Boolean(invoiceHref) },
  );
  const invoiceBalance = typeof invoiceMoney?.balance === 'number' ? invoiceMoney.balance : null;
  const editedAmount = Number(watched.amount) || 0;
  const projectedBalance =
    invoiceBalance == null ? null : Math.max(0, invoiceBalance - editedAmount);
  const overBalance = invoiceBalance != null && editedAmount > invoiceBalance + 0.001;

  const onSubmit = async (data: FormData) => {
    if (isPaidLocked) return;
    setSubmitError('');
    try {
      await api.put(`payments/${id}`, { json: data }).json();
      // The server wrote the change: re-read the payment (and the invoice it
      // moves) so the detail page shows the server state, not a local guess.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PAYMENT_KEY(id) }),
        queryClient.invalidateQueries({ queryKey: PAYMENT_EVENTS_KEY(id) }),
        queryClient.invalidateQueries({ queryKey: PAYMENTS_PREFIX }),
        queryClient.invalidateQueries({ queryKey: INVOICES_PREFIX }),
      ]);
      router.push(`/payments/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const descriptionParts: string[] = [];
  if (tenantName) descriptionParts.push(tenantName);
  if (roomNumber) descriptionParts.push(`Room ${roomNumber}`);

  return (
    <FormPage
      title="Edit Payment"
      description={
        descriptionParts.length > 0 ? descriptionParts.join(' · ') : 'Update payment details'
      }
      backHref={`/payments/${id}`}
      error={submitError || errorMessage(queryError)}
      isLoading={isLoading}
      maxWidth="form"
    >
      {isPaidLocked && (
        <div className="mb-6 flex items-start gap-3 rounded-(--radius-lg) border border-(--color-warning-300) bg-(--color-warning-50) p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-(--color-warning-600)" />
          <div className="text-sm font-semibold text-(--color-warning-800)">
            <p>This payment is marked paid and cannot be edited.</p>
            <p className="mt-1 text-xs font-medium text-(--color-warning-700)">
              Use{' '}
              <Link
                href={`/payments/${id}`}
                className="underline underline-offset-2 hover:text-(--color-warning-900)"
              >
                the detail page
              </Link>{' '}
              to void it (returns the amount to owed) or record an adjustment payment instead.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FormCard
            onSubmit={
              isPaidLocked
                ? (e) => {
                    e.preventDefault();
                  }
                : handleSubmit(onSubmit)
            }
            footer={
              isPaidLocked ? (
                <FormActions
                  loading={false}
                  cancelHref={`/payments/${id}`}
                  cancelLabel="Back to detail"
                  hideSubmit
                  divided={false}
                />
              ) : (
                <FormActions
                  loading={isSubmitting}
                  cancelHref={`/payments/${id}`}
                  submitLabel="Save Changes"
                  divided={false}
                />
              )
            }
          >
            <fieldset disabled={isPaidLocked} className="min-w-0 space-y-0 disabled:opacity-70">
              <FormSection
                title="Payment details"
                description="Amount, method, and payment category"
              >
                <FormGrid>
                  <Input
                    label="Amount (₹)"
                    type="number"
                    step="0.01"
                    error={errors.amount?.message}
                    {...register('amount')}
                  />
                  <Select
                    label="Method"
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'bank_transfer', label: 'Bank transfer' },
                      { value: 'upi', label: 'UPI' },
                      { value: 'other', label: 'Other' },
                    ]}
                    error={errors.method?.message}
                    {...register('method')}
                  />
                  <Select
                    label="Type"
                    options={[
                      { value: 'rent', label: 'Rent' },
                      { value: 'deposit', label: 'Deposit' },
                      { value: 'electricity', label: 'Electricity' },
                      { value: 'laundry', label: 'Laundry' },
                      { value: 'other', label: 'Other' },
                    ]}
                    error={errors.type?.message}
                    {...register('type')}
                  />
                </FormGrid>
              </FormSection>

              <FormSection
                title="Status and notes"
                description="Verification state and optional remarks"
                divided
              >
                <FormGrid>
                  <div>
                    <Select
                      label="Status"
                      options={[
                        { value: 'pending', label: 'Pending' },
                        { value: 'pending_verification', label: 'Pending verification' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]}
                      error={errors.status?.message}
                      helperText="Paid is set only through Verify on the detail page"
                      {...register('status')}
                    />
                    {watched.status && STATUS_HELP[watched.status] && (
                      <p className="text-12 mt-1.5 flex items-start gap-1.5 font-medium text-(--color-text-secondary)">
                        <History className="mt-0.5 h-3 w-3 shrink-0" />
                        {STATUS_HELP[watched.status]}
                      </p>
                    )}
                  </div>
                  <FormFullWidth>
                    <Textarea
                      label="Notes"
                      rows={3}
                      placeholder="Optional notes..."
                      error={errors.notes?.message}
                      {...register('notes')}
                    />
                  </FormFullWidth>
                </FormGrid>
              </FormSection>
            </fieldset>
          </FormCard>
        </div>

        {/* Context rail */}
        <div className="space-y-4 xl:col-span-1">
          {context && (
            <div className={clsx(surfaceCardClass, 'sticky top-6 space-y-4 p-5')}>
              <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
                Linked records
              </h3>

              <div className={clsx(surfaceNestedClass, 'space-y-2.5 p-3.5')}>
                {tenantId ? (
                  <Link
                    href={`/tenants/${tenantId}`}
                    className="flex items-center gap-2 text-sm font-bold text-(--color-brand-600) hover:underline"
                  >
                    <User className="h-4 w-4 shrink-0" />
                    {tenantName}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
                    <User className="h-4 w-4 shrink-0" />
                    {tenantName}
                  </span>
                )}
                {roomNumber &&
                  (roomId ? (
                    <Link
                      href={`/rooms/${roomId}`}
                      className="flex items-center gap-2 text-xs font-semibold text-(--color-brand-600) hover:underline"
                    >
                      <Home className="h-3.5 w-3.5 shrink-0" />
                      Room {roomNumber}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-xs font-semibold text-(--color-text-secondary)">
                      <Home className="h-3.5 w-3.5 shrink-0" />
                      Room {roomNumber}
                    </span>
                  ))}
                {invoiceHref && (
                  <Link
                    href={`/invoices/${invoiceHref}`}
                    className="flex items-center gap-2 font-mono text-xs font-bold text-(--color-brand-600) hover:underline"
                  >
                    <Receipt className="h-3.5 w-3.5 shrink-0" />
                    {invoiceLabel}
                  </Link>
                )}
                {typeof context.amount === 'number' && (
                  <span className="flex items-center gap-2 text-xs font-semibold text-(--color-text-secondary) tabular-nums">
                    <Hash className="h-3.5 w-3.5 shrink-0" />₹
                    {context.amount.toLocaleString('en-IN')}
                    {context.method ? ` via ${context.method.replace(/_/g, ' ')}` : ''}
                  </span>
                )}
                {context.utrNumber && (
                  <span className="text-2xs block font-mono font-bold text-(--color-text-muted)">
                    UTR {context.utrNumber}
                  </span>
                )}
              </div>

              <div>
                <p className="text-2xs tracking-label mb-1.5 font-bold text-(--color-text-muted) uppercase">
                  Current status
                </p>
                <StatusBadge
                  variant={statusToVariant(context.status)}
                  label={context.status.replace(/_/g, ' ')}
                />
              </div>

              {/* The impact of the amount on the bill this payment settles. The
                  balance is the server's; the page never derives one. */}
              <div className={clsx(surfaceNestedClass, 'space-y-2 p-3.5')}>
                <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                  Impact on the invoice
                </p>
                {invoiceMoney?.status && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-(--color-text-muted)">Invoice status</span>
                    <StatusBadge
                      variant={statusToVariant(invoiceMoney.status)}
                      label={invoiceMoney.status.replace(/_/g, ' ')}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-(--color-text-muted)">Invoice total</span>
                  <span className="tabular-nums">
                    {typeof invoiceMoney?.totalAmount === 'number'
                      ? fmtMoney(invoiceMoney.totalAmount)
                      : 'Not reported'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-(--color-text-muted)">
                    Balance reported now
                  </span>
                  <span className="font-bold text-(--color-danger-700) tabular-nums">
                    {invoiceBalance == null ? 'Not reported' : fmtMoney(invoiceBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-(--border-color) pt-2 text-xs">
                  <span className="font-medium text-(--color-text-muted)">
                    Projected balance after, from the balance reported now
                  </span>
                  <span className="font-bold text-(--color-text-primary) tabular-nums">
                    {projectedBalance == null ? 'Needs server balance' : fmtMoney(projectedBalance)}
                  </span>
                </div>
                {overBalance && (
                  <p className="text-2xs flex items-start gap-1.5 font-semibold text-(--color-warning-700)">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    This amount is above the balance the server reports. The edit route accepts any
                    amount above zero, so the invoice would read as settled.
                  </p>
                )}
              </div>

              {!isPaidLocked && isDirty && (
                <div className="flex items-start gap-2 rounded-(--radius-md) border border-(--color-info-200) bg-(--color-info-50) px-3 py-2 text-xs font-semibold text-(--color-info-800)">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Unsaved changes — save or cancel before leaving.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={guard.guardOpen}
        variant="warning"
        title="Leave with unsaved changes?"
        message="Your edits to this payment will be lost if you leave now."
        confirmLabel="Leave anyway"
        cancelLabel="Keep editing"
        onConfirm={guard.confirmLeave}
        onCancel={guard.cancelLeave}
      />
    </FormPage>
  );
}
