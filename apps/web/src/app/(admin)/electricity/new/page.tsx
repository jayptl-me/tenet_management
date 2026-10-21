'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueries, type UseQueryOptions } from '@tanstack/react-query';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Bell,
  Building2,
  Calculator,
  CheckCircle2,
  FileUp,
  Plus,
  Scale,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { queryJson } from '@/lib/query';
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

/** The room count the server reports for one room. */
interface RoomOccupantsBody {
  success: boolean;
  meta: { total: number };
}

/** The active rooms, so the preview can name a room instead of an id. */
interface RoomsListBody {
  success: boolean;
  data: Array<{ _id: string; roomNumber?: string }>;
}

const ROOMS_KEY = ['rooms', 'list'] as const;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

// ── Component ──────────────────────────────────────────────────────────

export default function NewElectricityPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [billImage, setBillImage] = useState<File | null>(null);
  const [populatingRooms, setPopulatingRooms] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      month: currentMonth(),
      totalBillAmount: 0,
      billImageUrl: '',
      notes: '',
      varianceReason: '',
      roomEntries: [{ roomId: '', previousReading: 0, currentReading: 0, ratePerUnit: 8 }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'roomEntries' });
  const entries = useWatch({ control, name: 'roomEntries' });
  const totalBillAmount = useWatch({ control, name: 'totalBillAmount' });

  /**
   * What the server will compute from the readings.
   *
   * The model derives the units and the room amount from the readings when the
   * bill is saved (apps/api/src/models/electricityBill.ts:138-148), and the
   * server's figure is the one that ends up on the bill. This is the preview
   * of that computation, so the office can see the gap while it types.
   */
  const readingsTotal = (entries ?? []).reduce((sum, entry) => {
    const units = Math.max(0, (entry?.currentReading || 0) - (entry?.previousReading || 0));
    return sum + units * (entry?.ratePerUnit || 0);
  }, 0);

  const billTotal = Number(totalBillAmount) || 0;
  const reconcileDiff = Math.abs(billTotal - readingsTotal);
  const addsUp = reconcileDiff <= RECONCILE_TOLERANCE;
  const blockedByServer = reconcileDiff > RECONCILE_BLOCK_THRESHOLD;

  /**
   * The residents the server lists for each room of the bill.
   *
   * The server splits a room amount between the residents who were in that
   * room during the billing month (apps/api/src/routes/electricity.ts:744-756).
   * The count below is the residents the server lists for the room today, so
   * it is a preview and not the split the server will make.
   */
  const roomIds = useMemo(() => {
    const ids = (entries ?? []).map((entry) => entry?.roomId ?? '').filter((id) => id !== '');
    return Array.from(new Set(ids));
  }, [entries]);

  const occupantQueries = useQueries({
    queries: roomIds.map((roomId): UseQueryOptions<RoomOccupantsBody, Error> => ({
      queryKey: ['tenants', 'room-occupants', roomId],
      queryFn: () => queryJson<RoomOccupantsBody>(`tenants?roomId=${roomId}&isActive=true&limit=1`),
      staleTime: 30_000,
    })),
  });

  const occupantsByRoom = new Map<string, number>();
  roomIds.forEach((roomId, index) => {
    occupantsByRoom.set(roomId, occupantQueries[index]?.data?.meta.total ?? 0);
  });

  /**
   * The room numbers, so the preview names a room and not an id.
   *
   * The same list the room picker reads, so the office sees the same name in
   * the picker and in the preview.
   */
  const { data: roomsBody } = useApiQuery<RoomsListBody>(
    ROOMS_KEY,
    'rooms?limit=100&isActive=true',
    {
      staleTime: 300_000,
    },
  );
  const roomNameById = new Map(
    (roomsBody?.data ?? []).map((room) => [room._id, room.roomNumber ?? 'Room']),
  );

  const populateAllRooms = async () => {
    setPopulatingRooms(true);
    try {
      const res = await api.get('rooms?limit=100&isActive=true').json<{
        success: boolean;
        data: Array<{ _id: string }>;
      }>();
      if (res.data && res.data.length > 0) {
        replace(
          res.data.map((r) => ({
            roomId: r._id,
            previousReading: 0,
            currentReading: 0,
            ratePerUnit: 8,
          })),
        );
      }
    } catch {
      // preserve current entries on fetch failure
    } finally {
      setPopulatingRooms(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');

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
      const res = await api
        .post('electricity', {
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
        .json<{
          success: boolean;
          data: { _id?: string; id?: string; status?: string } | Record<string, unknown>;
        }>();

      // The server wrote the bill. It lands as a draft: nobody is charged and
      // nobody is told until it is distributed.
      const billId =
        (res.data as { _id?: string; id?: string })?._id ?? (res.data as { id?: string })?.id;
      if (billId && billImage) {
        try {
          const formData = new FormData();
          formData.append('file', billImage);
          await api.post(`electricity/${billId}/image`, { body: formData }).json();
        } catch (uploadErr) {
          const parsedUpload = await parseApiError(uploadErr);
          // The bill exists; surface the upload problem without failing the flow.
          setSubmitError(`Bill saved, but image upload failed: ${parsedUpload.message}`);
          router.push(`/electricity/${billId}`);
          return;
        }
      }
      router.push(billId ? `/electricity/${billId}` : '/electricity');
    } catch (err) {
      const parsed = await parseApiError(err);
      setSubmitError(parsed.message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Electricity Bill"
      description="The month bill, from the utility invoice: the readings go in per room"
      backHref="/electricity"
      error={submitError}
      maxWidth="form"
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <FormCard
            onSubmit={handleSubmit(onSubmit)}
            footer={
              <FormActions
                loading={isSubmitting}
                cancelHref="/electricity"
                submitLabel="Save as draft"
                divided={false}
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
                    label="Month"
                    placeholder="YYYY-MM"
                    error={err.month?.message}
                    {...register('month')}
                  />
                  <Input
                    label="Total bill amount (₹)"
                    type="number"
                    min={0}
                    step="0.01"
                    error={err.totalBillAmount?.message}
                    {...register('totalBillAmount')}
                  />
                  <Input
                    label="Bill image URL (optional)"
                    type="url"
                    placeholder="https://..."
                    error={err.billImageUrl?.message}
                    {...register('billImageUrl')}
                  />
                </FormGrid>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2 text-sm font-semibold text-(--color-text-primary) hover:border-(--color-brand-400)">
                    <FileUp className="h-4 w-4" />
                    {billImage ? billImage.name : 'Upload bill image (optional)'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (file && file.size > 5 * 1024 * 1024) {
                          setSubmitError('Bill image must be under 5MB.');
                          return;
                        }
                        setSubmitError('');
                        setBillImage(file);
                      }}
                    />
                  </label>
                  {billImage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBillImage(null)}
                    >
                      Remove file
                    </Button>
                  )}
                </div>
              </FormSection>

              <FormSection
                title="Room readings"
                description="Per-room meter readings for this billing period"
                divided
                action={
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={populatingRooms}
                      onClick={populateAllRooms}
                      title="Populate all active rooms"
                    >
                      <Building2 className="h-4 w-4" /> Populate rooms
                    </Button>
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
                    >
                      <Plus className="h-4 w-4" /> Add room
                    </Button>
                  </div>
                }
              >
                <div className="space-y-3">
                  {fields.map((field, idx) => {
                    const entry = entries?.[idx];
                    const units = entry
                      ? Math.max(0, (entry.currentReading || 0) - (entry.previousReading || 0))
                      : 0;
                    const amount = units * (entry?.ratePerUnit || 0);
                    const occupants = entry?.roomId ? occupantsByRoom.get(entry.roomId) : undefined;

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
                                endpoint="rooms?limit=100&isActive=true"
                                value={rf.value}
                                onChange={rf.onChange}
                                placeholder="Select room..."
                                labelKey={roomLabel}
                                valueKey="_id"
                                dataPath="data"
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
                        />

                        <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Remove room reading ${idx + 1}`}
                            onClick={() => remove(idx)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

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
                          {occupants != null && (
                            <span className="text-(--color-text-muted)">
                              {occupants} resident(s) the server lists in this room
                            </span>
                          )}
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
                />
                <Textarea
                  label="Notes"
                  rows={3}
                  placeholder="Optional notes..."
                  {...register('notes')}
                />
              </FormSection>
            </div>
          </FormCard>
        </div>

        {/* The consequence rail: what the numbers say, and what the two
            actions of the bill do. */}
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
                  ? 'The server refuses to save a bill whose readings and total are more than ₹10,000 apart. Correct the readings or the total.'
                  : 'The readings do not add up to the utility bill. The server saves the bill anyway, but the office cannot finalize it until the reason for the gap is written down in the variance reason.'}
            </p>
          </div>

          {/* What the office is about to do, said before it happens. */}
          <div className={clsx(surfaceNestedClass, 'p-4')}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-(--color-brand-500)" />
              <h3 className="font-display text-sm font-bold text-(--color-text-primary)">
                Who pays what
              </h3>
            </div>
            {fields.length === 0 ? (
              <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                Add a room to see what it costs.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {fields.map((field, idx) => {
                  const entry = entries?.[idx];
                  if (!entry?.roomId) return null;
                  const units = Math.max(
                    0,
                    (entry.currentReading || 0) - (entry.previousReading || 0),
                  );
                  const amount = units * (entry.ratePerUnit || 0);
                  const occupants = occupantsByRoom.get(entry.roomId) ?? 0;
                  const perResident = occupants > 0 ? amount / occupants : null;
                  return (
                    <div key={field.id} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-(--color-text-primary)">
                          {roomNameById.get(entry.roomId) ?? 'Room'}
                        </span>
                        <span className="font-mono font-semibold text-(--color-text-primary) tabular-nums">
                          {fmtMoney(amount)}
                        </span>
                      </div>
                      <p className="text-2xs font-medium text-(--color-text-muted)">
                        {occupants > 0
                          ? `${occupants} resident(s) the server lists in this room today, about ${fmtMoney(
                              Math.round(perResident ?? 0),
                            )} each`
                          : 'The server lists no resident in this room today'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
              A preview, not the split: the server splits a room amount between the residents who
              were in that room during the billing month, and it writes the exact share on their
              invoice when the bill is distributed.
            </p>
          </div>

          <div className={clsx(surfaceNestedClass, 'p-4')}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-(--color-brand-500)" />
              <h3 className="font-display text-sm font-bold text-(--color-text-primary)">
                What happens next
              </h3>
            </div>
            <div className="text-2xs mt-3 space-y-2.5 font-medium text-(--color-text-secondary)">
              <p className="flex items-start gap-1.5">
                <Zap className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                Saving writes a <strong>draft</strong>. No resident is charged and nobody is told.
              </p>
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-(--color-warning-600)" />
                Finalizing locks the readings: the server refuses every later edit of the bill, and
                the office cannot finalize it while the readings do not add up without a reason.
              </p>
              <p className="flex items-start gap-1.5">
                <Users className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                Distributing splits every room amount between the residents who were in that room
                during the month and writes the share onto their invoice for the month. It opens the
                invoice if there is none, and it opens or updates the pending payment that covers
                it.
              </p>
              <p className="flex items-start gap-1.5">
                <Scale className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                The invoice it opens is issued as sent and is due on the 5th of the billing month,
                or on the 5th of the next month when that date has passed. An invoice that already
                exists keeps its own due date.
              </p>
              <p className="flex items-start gap-1.5">
                <Bell className="mt-0.5 h-3 w-3 shrink-0 text-(--color-brand-600)" />
                Every resident the server charged gets an electricity_bill notification with their
                share. Nobody is told while the bill is a draft.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FormPage>
  );
}
