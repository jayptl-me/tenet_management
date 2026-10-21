'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Home,
  Hash,
  Banknote,
  Zap,
  Receipt,
  Building,
  Lock,
  AlertTriangle,
  CreditCard,
  Bell,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';
import { useUnsavedGuardState } from '@/hooks/useUnsavedGuard';
import { tenantDisplayName, tenantRoomNumber } from '@/lib/api-shapes';
import { clsx } from 'clsx';

const schema = z.object({
  rentAmount: z.coerce.number().min(0, 'Rent amount cannot be negative'),
  electricityAmount: z.coerce.number().min(0, 'Electricity amount cannot be negative'),
  otherCharges: z.coerce.number().min(0, 'Other charges cannot be negative'),
  dueDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'cancelled']),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface InvoiceData {
  _id: string;
  invoiceNumber?: string;
  month: string;
  rentAmount: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  paidAmount?: number;
  /** Server-computed amount still due. null when the server did not report one. */
  balance?: number | null;
  dueDate?: string | null;
  status: string;
  tenantId?: {
    _id?: string;
    userId?: { name?: string; phone?: string };
    roomId?: {
      roomNumber?: string;
      floorId?: { label?: string; floorNumber?: number } | string | null;
    };
    bedId?: string;
  };
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

const INVOICE_KEY = (id: string) => ['invoices', id] as const;

const INVOICES_PREFIX = ['invoices'] as const;

const PAYMENTS_SUMMARY_PREFIX = ['payments', 'summary'] as const;

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [submitError, setSubmitError] = useState('');
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

  /**
   * The invoice is read through the shared query stack, like every other
   * record: the load takes part in the cache and a write invalidates it.
   */
  const {
    data: invoiceData = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<InvoiceData>(INVOICE_KEY(id), `invoices/${id}`, { enabled: Boolean(id) });

  // The id whose values are already in the form. A refetch of the same record
  // must never wipe what the operator is typing.
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!invoiceData || loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    const status = invoiceData.status;
    // Never coerce paid/partial -> sent (that clobbers payment-driven status on save)
    const editableStatus = (['draft', 'sent', 'overdue', 'cancelled'] as const).includes(
      status as 'draft' | 'sent' | 'overdue' | 'cancelled',
    )
      ? (status as FormData['status'])
      : 'sent';
    const values: FormData = {
      rentAmount: invoiceData.rentAmount,
      electricityAmount: invoiceData.electricityAmount,
      otherCharges: invoiceData.otherCharges,
      dueDate: invoiceData.dueDate ? String(invoiceData.dueDate).slice(0, 10) : '',
      status: editableStatus,
    };
    reset(values);
    setInitial(values);
  }, [invoiceData, id, reset]);

  const rentAmount = useWatch({ control, name: 'rentAmount' });
  const electricityAmount = useWatch({ control, name: 'electricityAmount' });
  const otherCharges = useWatch({ control, name: 'otherCharges' });

  const autoTotal = useMemo(() => {
    return (
      (Number(rentAmount) || 0) + (Number(electricityAmount) || 0) + (Number(otherCharges) || 0)
    );
  }, [rentAmount, electricityAmount, otherCharges]);

  const watched = useWatch({ control });
  const isDirty = useMemo(() => {
    if (initial.rentAmount == null) return false;
    return (
      Number(watched.rentAmount) !== Number(initial.rentAmount) ||
      Number(watched.electricityAmount) !== Number(initial.electricityAmount) ||
      Number(watched.otherCharges) !== Number(initial.otherCharges) ||
      (watched.dueDate ?? '') !== (initial.dueDate ?? '') ||
      watched.status !== initial.status
    );
  }, [watched, initial]);

  const isPaymentDriven = invoiceData?.status === 'paid' || invoiceData?.status === 'partial';
  const isPaidLocked = invoiceData?.status === 'paid';
  const guard = useUnsavedGuardState(isDirty && !isPaidLocked && !isSubmitting);

  const originalTotal = invoiceData?.totalAmount ?? 0;
  const totalDelta = autoTotal - originalTotal;
  // The balance the server reports now. The page never derives a balance: the
  // projection below is a projection from that number, and it is labelled as
  // one.
  const reportedBalance = typeof invoiceData?.balance === 'number' ? invoiceData.balance : null;
  const balanceAfter = reportedBalance == null ? null : Math.max(0, reportedBalance + totalDelta);
  const statusIsCancel = watched.status === 'cancelled';
  const statusIsSent = watched.status === 'sent';

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    if (invoiceData?.status === 'paid') {
      setSubmitError('Paid invoices are locked and cannot be updated.');
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        rentAmount: data.rentAmount,
        electricityAmount: data.electricityAmount,
        otherCharges: data.otherCharges,
        dueDate: data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`).toISOString() : undefined,
      };
      // Do not send status for partial (payment-driven) — would overwrite to "sent"
      if (invoiceData?.status !== 'partial') {
        payload.status = data.status;
      }
      await api.put(`invoices/${id}`, { json: payload }).json();
      // The server wrote the change: re-read the invoice so the detail page
      // shows the server balance and status, not a local guess.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: INVOICE_KEY(id) }),
        queryClient.invalidateQueries({ queryKey: INVOICES_PREFIX }),
        queryClient.invalidateQueries({ queryKey: PAYMENTS_SUMMARY_PREFIX }),
      ]);
      router.push(`/invoices/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const tenant = invoiceData?.tenantId;
  const descriptionParts: string[] = [];
  if (invoiceData?.invoiceNumber) descriptionParts.push(`#${invoiceData.invoiceNumber}`);
  if (invoiceData?.month) descriptionParts.push(invoiceData.month);

  return (
    <FormPage
      title="Edit Invoice"
      description={
        descriptionParts.length > 0 ? descriptionParts.join(' · ') : 'Update invoice line items'
      }
      backHref={`/invoices/${id}`}
      error={submitError || errorMessage(queryError)}
      isLoading={isLoading}
      maxWidth="form"
    >
      <div className="space-y-5">
        {isPaidLocked && (
          <div className="flex items-start gap-3 rounded-(--radius-lg) border border-(--color-warning-300) bg-(--color-warning-50) p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-(--color-warning-600)" />
            <div className="text-sm font-semibold text-(--color-warning-800)">
              <p>This invoice is paid and locked.</p>
              <p className="mt-1 text-xs font-medium text-(--color-warning-700)">
                Amounts, due date, and status cannot be edited. Void or adjust payments instead.
              </p>
            </div>
          </div>
        )}
        {invoiceData?.status === 'partial' && (
          <div className="flex items-start gap-3 rounded-(--radius-lg) border border-(--color-info-200) bg-(--color-info-50) p-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-(--color-brand-600)" />
            <div className="text-sm font-semibold text-(--color-info-900)">
              <p>This invoice is partially paid.</p>
              <p className="mt-1 text-xs font-medium text-(--color-info-800)">
                Amounts may still be adjusted; the paid and partial status is controlled by the
                payments and cannot be set by hand.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {tenant && (
              <div className={clsx(surfaceCardClass, 'p-4 sm:p-5')}>
                <h3 className="mb-3 text-sm font-bold tracking-tight text-(--color-text-primary)">
                  Tenant
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex min-h-10 items-center gap-2">
                    <User className="h-4 w-4 shrink-0 text-(--color-brand-500)" />
                    <span className="text-sm font-semibold text-(--color-text-primary)">
                      {tenantDisplayName(tenant)}
                    </span>
                  </div>
                  <div className="flex min-h-10 items-center gap-2">
                    <Home className="h-4 w-4 shrink-0 text-(--color-brand-500)" />
                    <span className="text-sm font-semibold text-(--color-text-primary)">
                      Room {tenantRoomNumber(tenant)}
                    </span>
                  </div>
                  {tenant.bedId && (
                    <div className="flex min-h-10 items-center gap-2">
                      <Hash className="h-4 w-4 shrink-0 text-(--color-brand-500)" />
                      <span className="text-sm font-semibold text-(--color-text-primary)">
                        Bed {tenant.bedId}
                      </span>
                    </div>
                  )}
                  {tenant.roomId?.floorId != null && typeof tenant.roomId.floorId === 'object' && (
                    <div className="flex min-h-10 items-center gap-2">
                      <Building className="h-4 w-4 shrink-0 text-(--color-brand-500)" />
                      <span className="text-sm font-semibold text-(--color-text-primary)">
                        {tenant.roomId.floorId.label ??
                          (tenant.roomId.floorId.floorNumber != null
                            ? `Floor ${tenant.roomId.floorId.floorNumber}`
                            : 'Floor')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <FormCard
              onSubmit={
                isPaidLocked
                  ? (e) => {
                      e.preventDefault();
                    }
                  : handleSubmit(onSubmit)
              }
              footer={
                <FormActions
                  loading={isSubmitting}
                  cancelHref={`/invoices/${id}`}
                  submitLabel={isPaidLocked ? 'Locked (paid)' : 'Save Changes'}
                  hideSubmit={isPaidLocked}
                  divided={false}
                />
              }
            >
              <FormSection title="Line items" description="Amounts roll up into the total below">
                <FormGrid cols={3}>
                  <Input
                    label="Rent amount"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    disabled={isPaidLocked}
                    error={errors.rentAmount?.message}
                    leftIcon={<Banknote className="h-4 w-4" />}
                    {...register('rentAmount')}
                  />
                  <Input
                    label="Electricity"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    disabled={isPaidLocked}
                    error={errors.electricityAmount?.message}
                    leftIcon={<Zap className="h-4 w-4" />}
                    {...register('electricityAmount')}
                  />
                  <Input
                    label="Other charges"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    disabled={isPaidLocked}
                    error={errors.otherCharges?.message}
                    leftIcon={<Receipt className="h-4 w-4" />}
                    {...register('otherCharges')}
                  />
                </FormGrid>
                <div className={clsx(surfaceNestedClass, 'mt-4 p-4')}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-(--color-text-secondary)">
                      Auto-calculated total
                    </span>
                    <span className="font-mono text-2xl font-bold tracking-tight text-(--color-text-primary) tabular-nums">
                      {fmtMoney(autoTotal)}
                    </span>
                  </div>
                  {!isPaidLocked && totalDelta !== 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-(--color-warning-700)">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {totalDelta > 0
                        ? `Increases the bill by ${fmtMoney(totalDelta)}`
                        : `Decreases the bill by ${fmtMoney(Math.abs(totalDelta))}`}
                      {balanceAfter != null
                        ? ` — the balance the server reports now (${fmtMoney(reportedBalance)}) would become ${fmtMoney(balanceAfter)}`
                        : ' — the server has not reported a balance for this invoice, so the new one is unknown until it is saved'}
                    </p>
                  )}
                </div>
              </FormSection>

              <FormSection title="Due date" description="Payment due date for this invoice" divided>
                <DatePicker
                  label="Due date"
                  disabled={isPaidLocked}
                  error={errors.dueDate?.message}
                  {...register('dueDate')}
                />
              </FormSection>

              {!isPaymentDriven && (
                <FormSection title="Status" divided>
                  <Select
                    label="Invoice status"
                    options={statusOptions}
                    error={errors.status?.message}
                    {...register('status')}
                  />
                </FormSection>
              )}
            </FormCard>
          </div>

          {/* Context rail */}
          <div className="space-y-4 xl:col-span-1">
            {invoiceData && (
              <div className={clsx(surfaceCardClass, 'sticky top-6 space-y-4 p-5')}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
                    {invoiceData.invoiceNumber}
                  </h3>
                  <StatusBadge
                    variant={statusToVariant(invoiceData.status)}
                    label={invoiceData.status.replace(/_/g, ' ')}
                  />
                </div>

                <div className={clsx(surfaceNestedClass, 'text-13 space-y-2 p-3.5')}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-(--color-text-muted)">Month</span>
                    <span className="font-semibold text-(--color-text-primary)">
                      {invoiceData.month}
                    </span>
                  </div>
                  {typeof invoiceData.paidAmount === 'number' ? (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-(--color-text-muted)">Settled</span>
                      <span className="font-semibold text-(--color-success-600) tabular-nums">
                        {fmtMoney(invoiceData.paidAmount)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-(--color-text-muted)">Balance</span>
                    <span className="font-display text-base font-bold text-(--color-danger-600) tabular-nums">
                      {reportedBalance == null ? 'Not reported' : fmtMoney(reportedBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-(--border-color) pt-2">
                    <span className="font-medium text-(--color-text-muted)">Current total</span>
                    <span className="font-semibold text-(--color-text-primary) tabular-nums">
                      {fmtMoney(invoiceData.totalAmount)}
                    </span>
                  </div>
                </div>

                {isPaymentDriven && (
                  <p className="text-2xs flex items-start gap-1.5 leading-relaxed font-medium text-(--color-text-muted)">
                    <CreditCard className="mt-0.5 h-3 w-3 shrink-0" />
                    Status is payment-driven for this invoice; it updates automatically when
                    payments are verified.
                  </p>
                )}

                {/* What the save does to the resident. An edit moves what the
                    resident owes, and the server tells them. */}
                <div className="space-y-2 border-t border-(--border-color) pt-3">
                  <p className="text-2xs tracking-label font-bold text-(--color-text-muted) uppercase">
                    What this save does
                  </p>
                  <p className="text-2xs flex items-start gap-1.5 leading-relaxed font-medium text-(--color-text-secondary)">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-(--color-warning-600)" />
                    Changing the amounts moves what the resident owes. The server notifies the
                    resident with the old and the new number.
                  </p>
                  {statusIsCancel && (
                    <p className="text-2xs flex items-start gap-1.5 leading-relaxed font-medium text-(--color-danger-700)">
                      <Bell className="mt-0.5 h-3 w-3 shrink-0" />
                      Cancelling voids the bill and notifies the resident. The server refuses the
                      cancel while the invoice still carries a balance.
                    </p>
                  )}
                  {statusIsSent && (
                    <p className="text-2xs flex items-start gap-1.5 leading-relaxed font-medium text-(--color-text-secondary)">
                      <Bell className="mt-0.5 h-3 w-3 shrink-0" />
                      Sending a draft does not notify the resident: only a moved amount and a
                      cancellation do.
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
      </div>

      <ConfirmModal
        open={guard.guardOpen}
        variant="warning"
        title="Leave with unsaved changes?"
        message="Your edits to this invoice will be lost if you leave now."
        confirmLabel="Leave anyway"
        cancelLabel="Keep editing"
        onConfirm={guard.confirmLeave}
        onCancel={guard.cancelLeave}
      />
    </FormPage>
  );
}
