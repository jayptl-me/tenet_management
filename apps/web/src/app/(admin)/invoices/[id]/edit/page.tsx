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

const schema = z.object({
  month: z.string().min(1, 'Month is required'),
  rentAmount: z.coerce.number().min(0, 'Rent amount cannot be negative'),
  electricityAmount: z.coerce.number().min(0, 'Electricity amount cannot be negative'),
  otherCharges: z.coerce.number().min(0, 'Other charges cannot be negative'),
  totalAmount: z.coerce.number().positive('Total amount must be positive'),
  status: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface InvoiceData extends FormData {
  _id: string;
  invoiceNumber?: string;
  tenantId?: {
    _id?: string;
    user?: { name?: string; phone?: string };
    room?: { roomNumber?: string; floor?: { label?: string } };
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

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const rentAmount = watch('rentAmount');
  const electricityAmount = watch('electricityAmount');
  const otherCharges = watch('otherCharges');

  const autoTotal = useMemo(() => {
    return (rentAmount || 0) + (electricityAmount || 0) + (otherCharges || 0);
  }, [rentAmount, electricityAmount, otherCharges]);

  useEffect(() => {
    setValue('totalAmount', autoTotal);
  }, [autoTotal, setValue]);

  useEffect(() => {
    if (!id) return;
    api.get(`invoices/${id}`).json<{ success: boolean; data: InvoiceData }>()
      .then((res) => {
        setInvoiceData(res.data);
        reset({
          month: res.data.month,
          rentAmount: res.data.rentAmount,
          electricityAmount: res.data.electricityAmount,
          otherCharges: res.data.otherCharges,
          totalAmount: res.data.totalAmount,
          status: res.data.status,
        });
        setIsLoading(false);
      })
      .catch(() => { setSubmitError('Failed to load invoice'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`invoices/${id}`, { json: data }).json();
      router.push('/invoices');
    } catch {
      setSubmitError('Failed to update invoice');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[color:var(--color-text-muted)]" /></div>;

  const tenant = invoiceData?.tenantId;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Invoice</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">
            {invoiceData?.invoiceNumber && <span className="font-mono text-xs">#{invoiceData.invoiceNumber}</span>}
          </p>
        </div>
      </div>

      {submitError && <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">{submitError}</div>}

      {/* Tenant Info Card */}
      {tenant && (
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 font-[family:var(--font-display)] text-sm font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Tenant</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[color:var(--color-brand-500)]" />
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">{tenant?.user?.name ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-[color:var(--color-brand-500)]" />
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">Room {tenant?.room?.roomNumber ?? 'N/A'}</span>
            </div>
            {tenant?.bedId && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[color:var(--color-brand-500)]" />
                <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">Bed {tenant.bedId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <Input label="Month" type="month" error={errors.month?.message} {...register('month')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Rent Amount" type="number" step="0.01" error={errors.rentAmount?.message} {...register('rentAmount')} />
            <Input label="Electricity" type="number" step="0.01" error={errors.electricityAmount?.message} {...register('electricityAmount')} />
            <Input label="Other Charges" type="number" step="0.01" error={errors.otherCharges?.message} {...register('otherCharges')} />
          </div>
          <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
            <div className="flex items-center justify-between">
              <span className="font-[family:var(--font-body)] text-sm font-semibold text-[color:var(--color-text-secondary)]">Auto-calculated Total</span>
              <span className="font-[family:var(--font-display)] text-2xl font-extrabold text-[color:var(--color-text-primary)]">₹{autoTotal.toLocaleString()}</span>
            </div>
            <input type="hidden" {...register('totalAmount')} />
          </div>
          <Select label="Status" options={statusOptions} error={errors.status?.message} {...register('status')} />
        </div>
        <div className="border-t-[color:var(--border-color)] mt-8 flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
