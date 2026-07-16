'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Zap, Calculator, Lock, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { roomLabel } from '@/lib/resource-select-presets';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

/** Block submit only when room sum vs bill total diverges by a clearly erroneous amount. */
const RECONCILE_BLOCK_THRESHOLD = 10000;

// ── Schema ──────────────────────────────────────────────

const roomEntrySchema = z.object({
  roomId: z.string().min(1, 'Room is required'),
  previousReading: z.coerce.number().min(0, 'Cannot be negative'),
  currentReading: z.coerce.number().min(0, 'Cannot be negative'),
  ratePerUnit: z.coerce.number().min(0, 'Rate must be >= 0'),
});

const formSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format'),
    totalBillAmount: z.coerce.number().min(0.01, 'Total bill amount must be > 0'),
    billImageUrl: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || /^https?:\/\//i.test(v), 'Must be a valid http(s) URL'),
    notes: z.string().optional(),
    roomEntries: z.array(roomEntrySchema).min(1, 'At least one room entry is required'),
  })
  .refine((data) => data.roomEntries.every((e) => e.currentReading >= e.previousReading), {
    message: 'Current reading must be >= previous reading for all entries',
    path: ['roomEntries'],
  })
  .refine(
    (data) => {
      const ids = data.roomEntries.map((e) => e.roomId);
      return new Set(ids).size === ids.length;
    },
    { message: 'Each room can only appear once', path: ['roomEntries'] },
  );

type FormData = z.infer<typeof formSchema>;

// ── Component ───────────────────────────────────────────

export default function EditElectricityPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [billStatus, setBillStatus] = useState('draft');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      month: '',
      totalBillAmount: 0,
      billImageUrl: '',
      notes: '',
      roomEntries: [{ roomId: '', previousReading: 0, currentReading: 0, ratePerUnit: 8 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'roomEntries' });

  // Watch entries for auto-calculations
  const entries = useWatch({ control, name: 'roomEntries' });
  const totalBillAmount = useWatch({ control, name: 'totalBillAmount' });

  const computeAutoTotal = useCallback((roomEntries: FormData['roomEntries']) => {
    return (roomEntries ?? []).reduce((sum, e) => {
      const units = Math.max(0, (e.currentReading || 0) - (e.previousReading || 0));
      return sum + units * (e.ratePerUnit || 0);
    }, 0);
  }, []);

  const autoTotal = computeAutoTotal(entries);
  const billTotal = Number(totalBillAmount) || 0;
  const reconcileDiff = Math.abs(billTotal - autoTotal);
  const showReconcileWarning = !isNaN(reconcileDiff) && reconcileDiff > 0.5;
  const blockReconcile = reconcileDiff > RECONCILE_BLOCK_THRESHOLD;
  const isLocked = billStatus === 'finalized' || billStatus === 'distributed';

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`electricity/${id}`).json<{
        success: boolean;
        data: {
          month: string;
          totalBillAmount: number;
          billImageUrl?: string;
          notes?: string;
          status: string;
          roomEntries: Array<{
            roomId?: string | { _id?: string };
            previousReading: number;
            currentReading: number;
            ratePerUnit: number;
          }>;
        };
      }>(),
    ])
      .then(([billRes]) => {
        const b = billRes.data;
        setBillStatus(b.status);

        reset({
          month: b.month ?? '',
          totalBillAmount: b.totalBillAmount ?? 0,
          billImageUrl: b.billImageUrl ?? '',
          notes: b.notes ?? '',
          roomEntries: (b.roomEntries ?? []).map((e) => ({
            roomId:
              typeof e.roomId === 'string' ? e.roomId : ((e.roomId as { _id?: string })?._id ?? ''),
            previousReading: e.previousReading,
            currentReading: e.currentReading,
            ratePerUnit: e.ratePerUnit,
          })),
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load electricity bill');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');

    if (billStatus === 'distributed' || billStatus === 'finalized') {
      setSubmitError(
        billStatus === 'finalized'
          ? 'Finalized bills cannot be edited'
          : 'Distributed bills cannot be edited',
      );
      return;
    }

    const roomSum = computeAutoTotal(data.roomEntries);
    const diff = Math.abs(data.totalBillAmount - roomSum);
    if (diff > RECONCILE_BLOCK_THRESHOLD) {
      setSubmitError(
        `Room amounts (₹${roomSum.toLocaleString('en-IN')}) and total bill (₹${data.totalBillAmount.toLocaleString('en-IN')}) differ by ₹${diff.toLocaleString('en-IN')}. Fix the readings or total before saving.`,
      );
      return;
    }

    try {
      await api
        .put(`electricity/${id}`, {
          json: {
            month: data.month,
            totalBillAmount: data.totalBillAmount,
            billImageUrl: data.billImageUrl?.trim() || undefined,
            notes: data.notes || undefined,
            roomEntries: data.roomEntries.map((en) => ({
              roomId: en.roomId,
              previousReading: en.previousReading,
              currentReading: en.currentReading,
              ratePerUnit: en.ratePerUnit,
            })),
          },
        })
        .json();
      router.push(`/electricity/${id}`);
    } catch {
      setSubmitError('Failed to update electricity bill');
    }
  };

  if (isLoading) {
    return (
      <FormPage
        title="Edit Electricity Bill"
        description="Loading bill data..."
        isLoading={true}
        backHref="/electricity"
        maxWidth="4xl"
      />
    );
  }

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Electricity Bill"
      description={
        isLocked
          ? `This bill is locked (${billStatus}) and cannot be edited`
          : `Status: ${billStatus} — units and amounts recompute automatically`
      }
      backHref="/electricity"
      error={submitError}
      maxWidth="4xl"
    >
      {isLocked && (
        <div className="mb-5 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--color-warning-400)] bg-[color:var(--color-warning-50)] p-4 text-[color:var(--color-warning-800)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">
                Bill is locked ({billStatus})
              </p>
              <p className="mt-0.5 text-xs font-semibold opacity-90">
                {billStatus === 'finalized'
                  ? 'Finalized bills cannot be edited. Create a new draft if needed.'
                  : 'Distributed bills cannot be edited.'}
              </p>
            </div>
          </div>
          <Link
            href={`/electricity/${id}`}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--color-warning-400)] bg-[color:var(--color-card-bg)] px-3 py-1.5 text-xs font-bold text-[color:var(--color-warning-800)] hover:bg-[color:var(--color-warning-100)]"
          >
            Back to detail
          </Link>
        </div>
      )}

      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref={`/electricity/${id}`}
            submitLabel={isLocked ? 'Read Only' : 'Save Changes'}
            divided={false}
            hideSubmit={isLocked}
          />
        }
      >
        <div className="space-y-6">
          <FormSection
            title="Bill details"
            description="Billing month and total amount for this cycle"
          >
            <FormGrid>
              <Input
                label="Month (YYYY-MM)"
                placeholder="2025-01"
                error={err.month?.message}
                {...register('month')}
                disabled={isLocked}
              />
              <Input
                label="Total bill amount (₹)"
                type="number"
                step="0.01"
                min={0}
                error={err.totalBillAmount?.message}
                {...register('totalBillAmount')}
                disabled={isLocked}
              />
              <Input
                label="Bill image URL (optional)"
                type="url"
                placeholder="https://..."
                error={err.billImageUrl?.message}
                {...register('billImageUrl')}
                disabled={isLocked}
              />
            </FormGrid>
          </FormSection>

          <FormSection
            title="Room readings"
            description="Per-room meter readings for this billing period"
            divided
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({ roomId: '', previousReading: 0, currentReading: 0, ratePerUnit: 8 })
                }
                disabled={isLocked}
              >
                <Plus className="h-4 w-4" /> Add room
              </Button>
            }
          >
            <div className="space-y-3">
              {fields.length === 0 && (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-color)] px-4 py-8 text-center text-sm text-[color:var(--color-text-secondary)]">
                  No room readings yet. Click &quot;Add room&quot; to begin.
                </p>
              )}

              {fields.map((field, idx) => {
                const entry = entries?.[idx];
                const units = entry
                  ? Math.max(0, (entry.currentReading || 0) - (entry.previousReading || 0))
                  : 0;
                const amount = units * (entry?.ratePerUnit || 0);

                return (
                  <div
                    key={field.id}
                    className={clsx(
                      surfaceNestedClass,
                      'grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]',
                    )}
                  >
                    <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                      <Controller
                        name={`roomEntries.${idx}.roomId`}
                        control={control}
                        render={({ field: rf }) => (
                          <ResourceSelect
                            label="Room"
                            endpoint="rooms?limit=100"
                            value={rf.value}
                            onChange={rf.onChange}
                            placeholder="Select room..."
                            labelKey={roomLabel}
                            valueKey="_id"
                            dataPath="data"
                            disabled={isLocked}
                          />
                        )}
                      />
                    </div>

                    <Input
                      label="Previous reading"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      error={
                        (errors.roomEntries?.[idx] as { previousReading?: { message?: string } })
                          ?.previousReading?.message
                      }
                      {...register(`roomEntries.${idx}.previousReading` as const)}
                      disabled={isLocked}
                    />
                    <Input
                      label="Current reading"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      error={
                        (errors.roomEntries?.[idx] as { currentReading?: { message?: string } })
                          ?.currentReading?.message
                      }
                      {...register(`roomEntries.${idx}.currentReading` as const)}
                      disabled={isLocked}
                    />
                    <Input
                      label="Rate/unit (₹)"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      min={0}
                      error={
                        (errors.roomEntries?.[idx] as { ratePerUnit?: { message?: string } })
                          ?.ratePerUnit?.message
                      }
                      {...register(`roomEntries.${idx}.ratePerUnit` as const)}
                      disabled={isLocked}
                    />

                    <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Remove room ${idx + 1}`}
                        onClick={() => remove(idx)}
                        disabled={fields.length <= 1 || isLocked}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Computed values for this entry */}
                    <div className="col-span-full flex items-center gap-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface-50)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text-secondary)]">
                      <Calculator className="h-3.5 w-3.5" />
                      <span>
                        Units:{' '}
                        <strong className="font-mono text-[color:var(--color-text-primary)]">
                          {units}
                        </strong>
                      </span>
                      <span className="text-[color:var(--border-color)]">|</span>
                      <span>
                        Amount:{' '}
                        <strong className="font-mono text-[color:var(--color-text-primary)]">
                          ₹{amount.toLocaleString('en-IN')}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {fields.length > 0 && (
              <div
                className={clsx(surfaceNestedClass, 'mt-4 flex items-center justify-between p-4')}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-text-secondary)]">
                  <Zap className="h-4 w-4" />
                  Computed total from readings
                </span>
                <span className="font-mono text-xl font-bold tabular-nums text-[color:var(--color-text-primary)]">
                  ₹{autoTotal.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {showReconcileWarning && !isLocked && (
              <div
                className={clsx(
                  'mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border p-4',
                  blockReconcile
                    ? 'border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-800)]'
                    : 'border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-800)]',
                )}
                role="status"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div className="min-w-0 text-sm">
                  <p className="font-bold">
                    {blockReconcile
                      ? 'Bill total and room amounts are far apart'
                      : 'Bill total and room amounts do not match'}
                  </p>
                  <p className="mt-0.5 font-medium opacity-90">
                    Total bill: ₹{billTotal.toLocaleString('en-IN')} · Room sum: ₹
                    {autoTotal.toLocaleString('en-IN')} · Difference: ₹
                    {reconcileDiff.toLocaleString('en-IN', {
                      maximumFractionDigits: 2,
                    })}
                    {blockReconcile
                      ? '. Correct values before saving.'
                      : '. You can still save; common-area or fixed charges may explain a small gap.'}
                  </p>
                </div>
              </div>
            )}
          </FormSection>

          <FormSection title="Notes" description="Optional remarks for this bill" divided>
            <Textarea
              label="Notes"
              rows={3}
              placeholder="Optional notes..."
              {...register('notes')}
              disabled={isLocked}
            />
          </FormSection>
        </div>
      </FormCard>
    </FormPage>
  );
}
