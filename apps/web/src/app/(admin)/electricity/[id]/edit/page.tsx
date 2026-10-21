'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, Calculator, Lock, Plus, Scale, Trash2, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
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

/**
 * The server refuses a bill whose room amounts and total are more than this
 * apart (apps/api/src/routes/electricity.ts:68-85). The form keeps the same
 * threshold and says so, so the office is never refused without a reason.
 */
const RECONCILE_BLOCK_THRESHOLD = 10000;

/** A difference under a rupee is the server's own rounding, not a gap. */
const RECONCILE_TOLERANCE = 0.5;

// ── Schema ─────────────────────────────────────────────────────────────

const roomEntrySchema = z.object({
  roomId: z.string().min(1, 'Room is required'),
  previousReading: z.coerce.number().min(0, 'Cannot be negative'),
  currentReading: z.coerce.number().min(0, 'Cannot be negative'),
  ratePerUnit: z.coerce.number().min(0, 'Rate must be >= 0'),
});

const formSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM format'),
    totalBillAmount: z.coerce.number().min(0, 'Total bill amount cannot be negative'),
    billImageUrl: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || /^https?:\/\//i.test(v), 'Must be a valid http(s) URL'),
    notes: z.string().optional(),
    varianceReason: z.string().max(500).optional(),
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

/** The bill as the server holds it (GET /electricity/:id). */
interface ElectricityBillData {
  _id: string;
  month: string;
  totalBillAmount: number;
  computedRoomTotal?: number;
  variance?: number;
  varianceReason?: string;
  billImageUrl?: string;
  notes?: string;
  status: string;
  roomEntries: Array<{
    roomId?: string | { _id?: string };
    previousReading: number;
    currentReading: number;
    ratePerUnit: number;
  }>;
}

const BILL_KEY = (id: string) => ['electricity', id] as const;
const ELECTRICITY_PREFIX = ['electricity'] as const;

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

// ── Component ──────────────────────────────────────────────────────────

export default function EditElectricityPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState('');

  /**
   * The bill is read through the shared query stack, like every other
   * record: the load takes part in the cache and a write invalidates it.
   */
  const {
    data: bill = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<ElectricityBillData>(BILL_KEY(id), `electricity/${id}`, {
    enabled: Boolean(id),
  });

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
      varianceReason: '',
      roomEntries: [{ roomId: '', previousReading: 0, currentReading: 0, ratePerUnit: 8 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'roomEntries' });

  // The id whose values are already in the form. A refetch of the same record
  // must never wipe what the operator is typing.
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bill || loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    reset({
      month: bill.month ?? '',
      totalBillAmount: bill.totalBillAmount ?? 0,
      billImageUrl: bill.billImageUrl ?? '',
      varianceReason: bill.varianceReason ?? '',
      notes: bill.notes ?? '',
      roomEntries: (bill.roomEntries ?? []).map((entry) => ({
        roomId: typeof entry.roomId === 'string' ? entry.roomId : (entry.roomId?._id ?? ''),
        previousReading: entry.previousReading,
        currentReading: entry.currentReading,
        ratePerUnit: entry.ratePerUnit,
      })),
    });
  }, [bill, id, reset]);

  const entries = useWatch({ control, name: 'roomEntries' });
  const totalBillAmount = useWatch({ control, name: 'totalBillAmount' });

  /**
   * What the server will compute from the readings.
   *
   * The model derives the units and the room amount from the readings when
   * the bill is saved (apps/api/src/models/electricityBill.ts:138-148), and
   * the server's figure is the one that ends up on the bill.
   */
  const readingsTotal = (entries ?? []).reduce((sum, entry) => {
    const units = Math.max(0, (entry?.currentReading || 0) - (entry?.previousReading || 0));
    return sum + units * (entry?.ratePerUnit || 0);
  }, 0);

  const billTotal = Number(totalBillAmount) || 0;
  const reconcileDiff = Math.abs(billTotal - readingsTotal);
  const addsUp = reconcileDiff <= RECONCILE_TOLERANCE;
  const blockedByServer = reconcileDiff > RECONCILE_BLOCK_THRESHOLD;

  // The server locks a bill once it is finalized and refuses to delete a
  // distributed one (apps/api/src/routes/electricity.ts:572-574, :1089-1091).
  const isLocked = bill?.status === 'finalized' || bill?.status === 'distributed';

  const onSubmit = async (data: FormData) => {
    setSubmitError('');

    if (isLocked) {
      setSubmitError(
        bill?.status === 'finalized'
          ? 'Finalized bills cannot be edited. The server refuses the write.'
          : 'Distributed bills cannot be edited. The server refuses the write.',
      );
      return;
    }

    const roomSum = (data.roomEntries ?? []).reduce((sum, entry) => {
      const units = Math.max(0, (entry.currentReading || 0) - (entry.previousReading || 0));
      return sum + units * (entry.ratePerUnit || 0);
    }, 0);
    const diff = Math.abs(data.totalBillAmount - roomSum);
    if (diff > RECONCILE_BLOCK_THRESHOLD) {
      setSubmitError(
        `Room amounts (${fmtMoney(roomSum)}) and total bill (${fmtMoney(data.totalBillAmount)}) differ by ${fmtMoney(diff)}. Fix the readings or total before saving.`,
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
            varianceReason: data.varianceReason?.trim() || undefined,
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
      // The server wrote the change: re-read the bill so the detail page shows
      // the server's variance and its status, not a local guess.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BILL_KEY(id) }),
        queryClient.invalidateQueries({ queryKey: ELECTRICITY_PREFIX }),
      ]);
      router.push(`/electricity/${id}`);
    } catch (err) {
      const parsed = await parseApiError(err);
      setSubmitError(parsed.message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Electricity Bill"
      description={
        isLocked
          ? `This bill is locked (${bill?.status}) and cannot be edited`
          : 'The readings and the utility total of a draft bill. The server recomputes the room amounts from them.'
      }
      backHref={`/electricity/${id}`}
      error={submitError || errorMessage(queryError)}
      isLoading={isLoading}
      maxWidth="form"
    >
      <div className="space-y-5">
        {isLocked && (
          <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-(--color-warning-300) bg-(--color-warning-50) p-4 text-(--color-warning-800) sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-(--color-warning-600)" />
              <div>
                <p className="text-sm font-bold">This bill is locked ({bill?.status})</p>
                <p className="mt-0.5 text-xs font-semibold opacity-90">
                  {bill?.status === 'finalized'
                    ? 'The server refuses every edit of a finalized bill (BILL_LOCKED). The readings are locked and the bill is on no invoice yet.'
                    : 'The server refuses every edit of a distributed bill (BILL_LOCKED). The shares are already on the resident invoices, so a correction is made on their invoice and not here.'}
                </p>
              </div>
            </div>
            <Link
              href={`/electricity/${id}`}
              className="inline-flex items-center justify-center rounded-(--radius-md) border border-(--color-warning-400) bg-(--color-card-bg) px-3 py-1.5 text-xs font-bold text-(--color-warning-800) hover:bg-(--color-warning-100)"
            >
              Back to the bill
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <FormCard
              onSubmit={
                isLocked
                  ? (event) => {
                      event.preventDefault();
                    }
                  : handleSubmit(onSubmit)
              }
              footer={
                <FormActions
                  loading={isSubmitting}
                  cancelHref={`/electricity/${id}`}
                  submitLabel={isLocked ? 'Read only' : 'Save Changes'}
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
                        append({
                          roomId: '',
                          previousReading: 0,
                          currentReading: 0,
                          ratePerUnit: 8,
                        })
                      }
                      disabled={isLocked}
                    >
                      <Plus className="h-4 w-4" /> Add room
                    </Button>
                  }
                >
                  <div className="space-y-3">
                    {fields.length === 0 && (
                      <p className="rounded-(--radius-md) border border-dashed border-(--border-color) px-4 py-8 text-center text-sm text-(--color-text-secondary)">
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
                              (
                                errors.roomEntries?.[idx] as {
                                  previousReading?: { message?: string };
                                }
                              )?.previousReading?.message
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
                              (
                                errors.roomEntries?.[idx] as {
                                  currentReading?: { message?: string };
                                }
                              )?.currentReading?.message
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

                          {/* What the server computes from these readings. */}
                          <div className="col-span-full flex flex-wrap items-center gap-x-4 gap-y-1 rounded-(--radius-md) bg-(--color-surface-50) px-3 py-1.5 text-xs font-semibold text-(--color-text-secondary)">
                            <span className="flex items-center gap-1.5">
                              <Calculator className="h-3.5 w-3.5" />
                              Units:{' '}
                              <strong className="font-mono text-(--color-text-primary)">
                                {units}
                              </strong>
                            </span>
                            <span>
                              Amount:{' '}
                              <strong className="font-mono text-(--color-text-primary)">
                                {fmtMoney(amount)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </FormSection>

                <FormSection
                  title="Variance and notes"
                  description="Why the readings and the utility total differ, if they do"
                  divided
                >
                  <Textarea
                    label="Variance reason (optional)"
                    rows={2}
                    placeholder="Explain any gap between bill total and room sum, e.g. common-area charges..."
                    {...register('varianceReason')}
                    disabled={isLocked}
                  />
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
          </div>

          {/* The consequence rail: what the numbers say, and what the save
              does. */}
          <div className="space-y-4 xl:col-span-1">
            <div className={clsx(surfaceNestedClass, 'p-4')}>
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-(--color-brand-500)" />
                <h3 className="font-display text-sm font-bold text-(--color-text-primary)">
                  Do the numbers add up
                </h3>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-(--color-text-muted)">Utility bill</span>
                  <span className="font-semibold text-(--color-text-primary) tabular-nums">
                    {fmtMoney(billTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-(--color-text-muted)">Readings at the tariff</span>
                  <span className="font-semibold text-(--color-text-primary) tabular-nums">
                    {fmtMoney(readingsTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-(--border-color) pt-2">
                  <span className="text-(--color-text-muted)">Difference</span>
                  <span
                    className={clsx(
                      'font-display text-base font-bold tabular-nums',
                      addsUp
                        ? 'text-(--color-success-700)'
                        : blockedByServer
                          ? 'text-(--color-danger-700)'
                          : 'text-(--color-warning-700)',
                    )}
                  >
                    {fmtMoney(reconcileDiff)}
                  </span>
                </div>
              </div>
              <p
                className={clsx(
                  'text-2xs mt-3 font-semibold',
                  addsUp
                    ? 'text-(--color-success-700)'
                    : blockedByServer
                      ? 'text-(--color-danger-700)'
                      : 'text-(--color-warning-700)',
                )}
              >
                {addsUp
                  ? 'The readings add up to the utility bill.'
                  : blockedByServer
                    ? 'The server refuses to save a bill whose readings and total are more than ₹10,000 apart.'
                    : 'The readings do not add up to the utility bill. The server saves the bill, but the office cannot finalize it until the reason for the gap is written down.'}
              </p>
            </div>

            <div className={clsx(surfaceNestedClass, 'p-4')}>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-(--color-brand-500)" />
                <h3 className="font-display text-sm font-bold text-(--color-text-primary)">
                  What this save does
                </h3>
              </div>
              <div className="text-2xs mt-3 space-y-2.5 font-medium text-(--color-text-secondary)">
                {isLocked ? (
                  <>
                    <p className="flex items-start gap-1.5">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-(--color-warning-600)" />
                      Nothing: the server refuses the write with BILL_LOCKED. This bill is read
                      only.
                    </p>
                    <p className="flex items-start gap-1.5">
                      <Zap className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                      {bill?.status === 'distributed'
                        ? 'The shares of this bill are already on the resident invoices, so the money it moved lives on their invoice now. A correction is made there, not on this bill.'
                        : 'The bill is finalized and not on any invoice yet, so no resident carries a share of it.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-start gap-1.5">
                      <Zap className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                      The server recomputes every room amount from the readings and the rate, and
                      the difference from the utility total, when it saves the bill.
                    </p>
                    <p className="flex items-start gap-1.5">
                      <Bell className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                      No resident is charged by this save and nobody is told: a draft bill is on no
                      invoice. The residents are charged when the bill is distributed.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FormPage>
  );
}
