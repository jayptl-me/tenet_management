'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BedDouble,
  Building2,
  CalendarDays,
  Clock,
  DoorOpen,
  FileText,
  Info,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { useApiQuery } from '@/hooks/useApiQuery';
import { tenantLabel } from '@/lib/resource-select-presets';

// ── Vocabulary ────────────────────────────────────────────────────────────────

const REASON_TEMPLATES = [
  'Family Function',
  'Medical',
  'Travel',
  'Emergency',
  'Festival',
  'Personal Work',
];

const schema = z.object({
  tenantId: z.string().min(1, 'Resident is required'),
  fromDate: z
    .string()
    .min(1, 'From date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  toDate: z
    .string()
    .min(1, 'To date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

type FormData = z.infer<typeof schema>;

/** The resident record the server holds, as the preview needs it. */
interface TenantStay {
  _id: string;
  bedId?: string | null;
  monthlyRent?: number;
  user?: { name?: string };
  room?: { roomNumber?: string; floor?: { label?: string } | null } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `₹${value.toLocaleString('en-IN')}`;
}

/** The days of the window, counted the way the server counts them. */
function inclusiveDays(from: string, to: string): number | null {
  if (!from || !to) return null;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function periodSummary(from: string, to: string): string {
  const n = inclusiveDays(from, to);
  if (n == null) return 'Pick both dates to preview the leave window.';
  if (n <= 0) return 'The from date is after the to date. The server refuses that window.';
  const today = new Date().toISOString().slice(0, 10);
  const span = `${n} day${n === 1 ? '' : 's'} inclusive`;
  if (to < today) return `${span} · entirely in the past (backdated)`;
  if (from > today) return `${span} · upcoming`;
  return `${span} · includes today`;
}

// ── The page ──────────────────────────────────────────────────────────────────

export default function NewLeavePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const watchedFromDate = useWatch({ control, name: 'fromDate' }) ?? '';
  const watchedToDate = useWatch({ control, name: 'toDate' }) ?? '';
  const tenantIdWatch = useWatch({ control, name: 'tenantId' });
  const fromWatch = useWatch({ control, name: 'fromDate' });
  const toWatch = useWatch({ control, name: 'toDate' });
  const reasonWatch = useWatch({ control, name: 'reason' });
  const days = inclusiveDays(fromWatch ?? '', toWatch ?? '');
  const rangeInvalid = days != null && days <= 0;

  /**
   * The stay of the resident, read from the server.
   *
   * The office files the absence against a bed, so the page shows where the
   * resident sleeps and what the rent on their record is, before the save.
   */
  const { data: stay } = useApiQuery<TenantStay>(
    ['leaves', 'new', 'tenant', tenantIdWatch ?? ''],
    `tenants/${tenantIdWatch ?? ''}`,
    { enabled: !!tenantIdWatch },
  );

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    if (data.fromDate > data.toDate) {
      setSubmitError('The from date must be on or before the to date.');
      return;
    }
    try {
      const res = await api
        .post('leaves', { json: data })
        .json<{ success: boolean; data?: { _id?: string } }>();
      const createdId = res.data?._id;
      router.push(createdId ? `/leaves/${createdId}` : '/leaves');
    } catch (err) {
      // The server's answer is the one that matters: it refuses an overlapping
      // leave (OVERLAPPING_LEAVE), a window that ends before it starts
      // (LEAVE_INVALID_RANGE) and a resident who is not active.
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Record a leave"
      description="File the absence of a resident. The request waits for a decision, and the decision writes the attendance board"
      backHref="/leaves"
      error={submitError}
      maxWidth="form"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/leaves"
            submitLabel="File the request"
            divided={false}
          />
        }
      >
        <FormSection
          title="The resident"
          icon={<UserRound />}
          description="Only an active resident can hold a leave request. The server refuses anyone else."
        >
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Resident"
                endpoint="tenants?isActive=true"
                value={field.value}
                onChange={(val) => {
                  field.onChange(val);
                }}
                placeholder="Select resident..."
                error={err.tenantId?.message}
                valueKey="_id"
                labelKey={tenantLabel}
                dataPath="data"
              />
            )}
          />
          {tenantIdWatch ? (
            <div className="mt-3 rounded-(--radius-md) border border-(--color-brand-200) bg-(--color-brand-50) p-3">
              {stay ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-(--color-brand-800)">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {stay.user?.name ?? 'Unknown'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5" />
                    Room {stay.room?.roomNumber ?? 'N/A'}
                    {stay.bedId ? ` · Bed ${stay.bedId}` : ''}
                  </span>
                  {stay.room?.floor?.label && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {stay.room.floor.label}
                    </span>
                  )}
                  {stay.bedId && (
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" />
                      Bed {stay.bedId}
                    </span>
                  )}
                  {stay.monthlyRent != null && (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {fmtMoney(stay.monthlyRent)}/mo on the record
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs font-semibold text-(--color-text-muted)">
                  Reading where the resident sleeps...
                </p>
              )}
            </div>
          ) : null}
        </FormSection>

        <FormSection
          title="The absence"
          icon={<CalendarDays />}
          description="The window the resident is away, counted from the first day to the last"
          divided
        >
          <FormGrid>
            <DatePicker
              label="From date"
              error={err.fromDate?.message}
              leftIcon={<CalendarDays className="h-4 w-4" />}
              name="fromDate"
              value={watchedFromDate}
              onChange={(value) => setValue('fromDate', value, { shouldValidate: true })}
            />
            <DatePicker
              label="To date"
              error={err.toDate?.message}
              leftIcon={<CalendarDays className="h-4 w-4" />}
              name="toDate"
              value={watchedToDate}
              onChange={(value) => setValue('toDate', value, { shouldValidate: true })}
            />
          </FormGrid>
          <div
            className={
              rangeInvalid
                ? 'mt-3 flex items-start gap-2 rounded-(--radius-md) border border-(--color-danger-300) bg-(--color-danger-50) px-3 py-2 text-sm'
                : 'mt-3 flex items-start gap-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50) px-3 py-2 text-sm'
            }
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-(--color-brand-600)" />
            <span className="text-xs font-semibold text-(--color-text-secondary)">
              {periodSummary(fromWatch ?? '', toWatch ?? '')}
            </span>
          </div>
          <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
            The server refuses a window that ends before it starts, and a window that overlaps
            another pending or approved leave of the same resident: cancel the old one first.
          </p>
        </FormSection>

        <FormSection
          title="The reason"
          icon={<FileText />}
          description="The resident reads this on their portal, next to the decision"
          divided
        >
          <Textarea
            label="Reason for the leave"
            rows={4}
            placeholder="Reason for the leave..."
            error={err.reason?.message}
            maxLength={500}
            {...register('reason')}
          />
          <div className="mt-1 flex items-center justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common reasons">
              {REASON_TEMPLATES.map((option) => {
                const selected = (reasonWatch ?? '').trim().toLowerCase() === option.toLowerCase();
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setValue('reason', option, { shouldValidate: true })}
                    className={
                      selected
                        ? 'rounded-full border border-(--color-brand-500) bg-(--color-brand-500) px-3 py-1 text-xs font-bold text-(--color-on-brand) shadow-(--shadow-xs)'
                        : 'rounded-full border border-(--border-color) bg-(--color-field-bg) px-3 py-1 text-xs font-semibold text-(--color-text-secondary) hover:border-(--color-brand-300) hover:text-(--color-text-primary)'
                    }
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <p className="text-2xs shrink-0 font-medium text-(--color-text-muted)">
              {(reasonWatch ?? '').length}/500
            </p>
          </div>
        </FormSection>

        {/* What the save commits. The office has to know what it is filing. */}
        <FormSection title="What the save commits" icon={<Info />} divided>
          <ul className="space-y-2 text-sm leading-relaxed text-(--color-text-secondary)">
            <li>
              The save files the request with the status pending and writes an entry in the audit
              log. The request then waits for a decision on the leaves queue.
            </li>
            <li>
              The attendance board is not touched by this save. The days of the window become
              on-leave records only when the request is approved, and a day with a real on-site
              check-in keeps its own record.
            </li>
            <li>
              The resident is not told by this save. The server pushes them a notification when the
              request is decided: the outcome is in the body of that message, and so is the reason
              when the request is refused.
            </li>
            <li>
              The rent does not change. The monthly bill is raised from the resident&apos;s own
              record, so a leave is not a deduction.
            </li>
          </ul>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
