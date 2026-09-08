'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserRound, CalendarDays, Banknote, AlertTriangle, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { surfaceNestedClass } from '@/lib/field-styles';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';
import { clsx } from 'clsx';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  month: z
    .string()
    .min(1, 'Month is required')
    .regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
});

type FormData = z.infer<typeof schema>;

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

interface TenantPreview {
  name: string;
  monthlyRent?: number;
}

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');
  const [rentPreview, setRentPreview] = useState<TenantPreview | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const prefilledTenantId = searchParams.get('tenantId') ?? '';

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: prefilledTenantId,
      month: currentMonth(),
    },
  });

  const tenantIdWatch = useWatch({ control, name: 'tenantId' });
  const monthWatch = useWatch({ control, name: 'month' });

  // Live preview: tenant rent + duplicate invoice check for the month.
  useEffect(() => {
    setRentPreview(null);
    setDuplicateWarning('');
    if (!tenantIdWatch) return;
    let cancelled = false;
    api
      .get(`tenants/${tenantIdWatch}`)
      .json<{ success: boolean; data: { user?: { name?: string }; monthlyRent?: number } }>()
      .then((res) => {
        if (!cancelled) {
          setRentPreview({
            name: res.data.user?.name ?? 'Unknown',
            monthlyRent: res.data.monthlyRent,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setRentPreview(null);
      });
    if (tenantIdWatch && monthWatch && /^\d{4}-\d{2}$/.test(monthWatch)) {
      api
        .get(`invoices?tenantId=${tenantIdWatch}&month=${monthWatch}&limit=1`)
        .json<{ success: boolean; data: Array<{ invoiceNumber?: string; status?: string }> }>()
        .then((res) => {
          if (!cancelled && (res.data ?? []).length > 0) {
            const existing = res.data[0]!;
            setDuplicateWarning(
              `An invoice${existing.invoiceNumber ? ` (${existing.invoiceNumber})` : ''} already exists for this tenant and month${existing.status ? ` — status ${existing.status.replace(/_/g, ' ')}` : ''}.`,
            );
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [tenantIdWatch, monthWatch]);

  const monthChips = [
    { label: 'Last month', value: lastMonth() },
    { label: 'This month', value: currentMonth() },
    { label: 'Next month', value: nextMonth() },
  ];

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const res = await api
        .post('invoices/generate-single', {
          json: { tenantId: data.tenantId, month: data.month },
        })
        .json<{ success: boolean; data?: { _id?: string } }>();
      const createdId = res.data?._id;
      router.push(createdId ? `/invoices/${createdId}` : '/invoices');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title="Generate Invoice"
      description="Auto-generates rent and electricity from tenant and room data"
      backHref="/invoices"
      error={submitError}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/invoices"
            submitLabel="Generate Invoice"
            divided={false}
          />
        }
      >
        <FormSection
          title="Invoice target"
          icon={<UserRound />}
          description="Line items are calculated from the tenant monthly rent and any finalized electricity share for the selected month"
        >
          <FormGrid>
            <Controller
              name="tenantId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Tenant"
                  endpoint="tenants?isActive=true"
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val);
                    setValue('tenantId', val);
                  }}
                  error={errors.tenantId?.message}
                  placeholder="Select a tenant..."
                  valueKey="_id"
                  labelKey={tenantLabel}
                  sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
                  dataPath="data"
                />
              )}
            />
            <div>
              <Input
                label="Month"
                placeholder="YYYY-MM"
                error={errors.month?.message}
                leftIcon={<CalendarDays className="h-4 w-4" />}
                {...register('month')}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {monthChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setValue('month', chip.value, { shouldValidate: true })}
                    className={clsx(
                      'rounded-[var(--radius-full)] border px-2.5 py-1 text-[11px] font-bold transition-colors',
                      monthWatch === chip.value
                        ? 'border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]'
                        : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-brand-300)]',
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </FormGrid>
          {rentPreview && (
            <div className={clsx(surfaceNestedClass, 'mt-4 space-y-2 p-4')}>
              <div className="flex items-center gap-2 text-[13px] font-bold text-[color:var(--color-text-primary)]">
                <Banknote className="h-4 w-4 text-[color:var(--color-brand-600)]" />
                {rentPreview.name}
              </div>
              {rentPreview.monthlyRent != null ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-[color:var(--color-text-secondary)]">
                    Monthly rent seeds the line items
                  </span>
                  <span className="font-display text-lg font-bold text-[color:var(--color-text-primary)] tabular-nums">
                    ₹{rentPreview.monthlyRent.toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-text-muted)]">
                  <Info className="h-3.5 w-3.5" />
                  Rent unavailable — line items will start empty. Open the invoice afterward to adjust
                  amounts.
                </p>
              )}
            </div>
          )}
          {duplicateWarning && (
            <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] px-3 py-2 text-xs font-semibold text-[color:var(--color-warning-800)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {duplicateWarning}
            </div>
          )}
        </FormSection>
      </FormCard>
    </FormPage>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
        </div>
      }
    >
      <NewInvoiceForm />
    </Suspense>
  );
}
