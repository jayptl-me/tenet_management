'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Home, Hash, Banknote, Zap, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';
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
  dueDate?: string | null;
  status: string;
  tenantId?: {
    _id?: string;
    userId?: { name?: string; phone?: string };
    roomId?: { roomNumber?: string };
    bedId?: string;
  };
}

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const rentAmount = useWatch({ control, name: 'rentAmount' });
  const electricityAmount = useWatch({ control, name: 'electricityAmount' });
  const otherCharges = useWatch({ control, name: 'otherCharges' });

  const autoTotal = useMemo(() => {
    return (rentAmount || 0) + (electricityAmount || 0) + (otherCharges || 0);
  }, [rentAmount, electricityAmount, otherCharges]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`invoices/${id}`)
      .json<{ success: boolean; data: InvoiceData }>()
      .then((res) => {
        setInvoiceData(res.data);
        const status = res.data.status;
        // Never coerce paid/partial -> sent (that clobbers payment-driven status on save)
        const editableStatus = (['draft', 'sent', 'overdue', 'cancelled'] as const).includes(
          status as 'draft' | 'sent' | 'overdue' | 'cancelled',
        )
          ? (status as FormData['status'])
          : 'sent';
        if (status === 'paid') {
          setSubmitError(
            'Paid invoices are locked. Amounts and status cannot be edited; adjust via payments if needed.',
          );
        }
        reset({
          rentAmount: res.data.rentAmount,
          electricityAmount: res.data.electricityAmount,
          otherCharges: res.data.otherCharges,
          dueDate: res.data.dueDate ? String(res.data.dueDate).slice(0, 10) : '',
          status: editableStatus,
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load invoice');
        setIsLoading(false);
      });
  }, [id, reset]);

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
        dueDate: data.dueDate
          ? new Date(`${data.dueDate}T00:00:00.000Z`).toISOString()
          : undefined,
      };
      // Do not send status for partial (payment-driven) — would overwrite to "sent"
      if (invoiceData?.status !== 'partial') {
        payload.status = data.status;
      }
      await api.put(`invoices/${id}`, { json: payload }).json();
      router.push('/invoices');
    } catch {
      setSubmitError(
        'Failed to update invoice. Paid invoices cannot be edited; paid/partial status is set by payments.',
      );
    }
  };

  const tenant = invoiceData?.tenantId;
  const isPaymentDriven = invoiceData?.status === 'paid' || invoiceData?.status === 'partial';
  const isPaidLocked = invoiceData?.status === 'paid';

  const descriptionParts: string[] = [];
  if (invoiceData?.invoiceNumber) descriptionParts.push(`#${invoiceData.invoiceNumber}`);
  if (invoiceData?.month) descriptionParts.push(invoiceData.month);

  return (
    <FormPage
      title="Edit Invoice"
      description={
        descriptionParts.length > 0 ? descriptionParts.join(' · ') : 'Update invoice line items'
      }
      backHref="/invoices"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {isPaidLocked && (
          <ErrorBanner message="This invoice is paid and locked. Amounts, due date, and status cannot be edited; adjust via payments if needed." />
        )}
        {invoiceData?.status === 'partial' && (
          <ErrorBanner message="This invoice is partially paid. Amounts may still be adjusted; paid/partial status is controlled by payments and cannot be set manually." />
        )}

        {tenant && (
          <div className={clsx(surfaceCardClass, 'p-4 sm:p-5')}>
            <h3 className="mb-3 text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Tenant
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex min-h-10 items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-[color:var(--color-brand-500)]" />
                <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {tenantDisplayName(tenant)}
                </span>
              </div>
              <div className="flex min-h-10 items-center gap-2">
                <Home className="h-4 w-4 shrink-0 text-[color:var(--color-brand-500)]" />
                <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  Room {tenantRoomNumber(tenant)}
                </span>
              </div>
              {tenant.bedId && (
                <div className="flex min-h-10 items-center gap-2">
                  <Hash className="h-4 w-4 shrink-0 text-[color:var(--color-brand-500)]" />
                  <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    Bed {tenant.bedId}
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
              cancelHref="/invoices"
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
                <span className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
                  Auto-calculated total
                </span>
                <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-[color:var(--color-text-primary)]">
                  ₹{autoTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </FormSection>

          <FormSection title="Due date" description="Payment due date for this invoice" divided>
            <Input
              label="Due date"
              type="date"
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
    </FormPage>
  );
}
