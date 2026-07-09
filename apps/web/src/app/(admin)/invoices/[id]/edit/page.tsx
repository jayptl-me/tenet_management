'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2, User, Home, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { tenantDisplayName, tenantRoomNumber } from '@/lib/api-shapes';

const schema = z.object({
  rentAmount: z.coerce.number().min(0, 'Rent amount cannot be negative'),
  electricityAmount: z.coerce.number().min(0, 'Electricity amount cannot be negative'),
  otherCharges: z.coerce.number().min(0, 'Other charges cannot be negative'),
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const rentAmount = watch('rentAmount');
  const electricityAmount = watch('electricityAmount');
  const otherCharges = watch('otherCharges');

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
        const editableStatus = (['draft', 'sent', 'overdue', 'cancelled'] as const).includes(
          status as 'draft' | 'sent' | 'overdue' | 'cancelled',
        )
          ? (status as FormData['status'])
          : 'sent';
        reset({
          rentAmount: res.data.rentAmount,
          electricityAmount: res.data.electricityAmount,
          otherCharges: res.data.otherCharges,
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
    try {
      await api
        .put(`invoices/${id}`, {
          json: {
            rentAmount: data.rentAmount,
            electricityAmount: data.electricityAmount,
            otherCharges: data.otherCharges,
            status: data.status,
          },
        })
        .json();
      router.push('/invoices');
    } catch {
      setSubmitError(
        'Failed to update invoice. Paid invoices cannot be edited; paid/partial status is set by payments.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  const tenant = invoiceData?.tenantId;
  const isPaymentDriven =
    invoiceData?.status === 'paid' || invoiceData?.status === 'partial';

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
            Edit Invoice
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-muted)]">
            {invoiceData?.invoiceNumber && (
              <span className="font-mono text-xs">#{invoiceData.invoiceNumber}</span>
            )}
            {invoiceData?.month && <span className="ml-2">· {invoiceData.month}</span>}
          </p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      {isPaymentDriven && (
        <ErrorBanner message="This invoice is paid or partially paid. Amounts may still be adjusted; status paid/partial is controlled by payments and cannot be set manually." />
      )}

      {tenant && (
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Tenant
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[color:var(--color-brand-500)]" />
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {tenantDisplayName(tenant)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-[color:var(--color-brand-500)]" />
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                Room {tenantRoomNumber(tenant)}
              </span>
            </div>
            {tenant.bedId && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[color:var(--color-brand-500)]" />
                <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  Bed {tenant.bedId}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Rent Amount"
              type="number"
              step="0.01"
              error={errors.rentAmount?.message}
              {...register('rentAmount')}
            />
            <Input
              label="Electricity"
              type="number"
              step="0.01"
              error={errors.electricityAmount?.message}
              {...register('electricityAmount')}
            />
            <Input
              label="Other Charges"
              type="number"
              step="0.01"
              error={errors.otherCharges?.message}
              {...register('otherCharges')}
            />
          </div>
          <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
                Auto-calculated Total
              </span>
              <span className="text-2xl font-extrabold text-[color:var(--color-text-primary)]">
                ₹{autoTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          {!isPaymentDriven && (
            <Select
              label="Status"
              options={statusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
          )}
        </div>
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-[color:var(--border-color)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
