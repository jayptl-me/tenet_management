'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, ExternalLink, Hash, Info, TriangleAlert, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { toTimeInputValue } from '@/lib/api-shapes';

const schema = z
  .object({
    date: z
      .string()
      .min(1, 'Date is required')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    status: z.enum(['present', 'absent', 'on_leave', 'not_returned']),
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.checkInTime && data.checkOutTime && data.checkOutTime < data.checkInTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['checkOutTime'],
        message: 'Check-out must be after check-in',
      });
    }
  });
type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'not_returned', label: 'Not Returned' },
];

const STATUS_VALUES = ['present', 'absent', 'on_leave', 'not_returned'];
const STATUS_LABELS: Record<string, string> = {
  present: 'present',
  absent: 'absent',
  on_leave: 'on leave',
  not_returned: 'not returned',
};

interface AttendanceDetail {
  _id: string;
  date: string;
  status: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string;
  bedId?: string;
  recordedBy?: { _id?: string; name?: string } | null;
  createdAt: string;
  updatedAt?: string;
  tenant?: {
    _id?: string;
    user?: { name?: string } | null;
    room?: { roomNumber?: string } | null;
  } | null;
  tenantId?: {
    _id?: string;
    userId?: { name?: string };
    roomId?: { roomNumber?: string };
    bedId?: string;
  };
}

interface ClashRow {
  _id: string;
  date: string;
  status: string;
}

/** Derived check-in/out duration label; empty until both times are set. */
function computeHoursRange(checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return '';
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  const totalMinutes = outH * 60 + outM - (inH * 60 + inM);
  if (totalMinutes >= 0) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }
  return 'Invalid (out before in) - fix before saving';
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

export default function EditAttendancePage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [submitError, setSubmitError] = useState('');
  const [clash, setClash] = useState<ClashRow | null>(null);

  /**
   * The record, read through the shared query stack.
   *
   * The skeleton is derived from the query instead of being pushed by an
   * effect, so a record that never arrives shows the error state instead of a
   * page that spins for ever.
   */
  const { data: attendanceData, error: queryError } = useApiQuery<AttendanceDetail>(
    ['attendance', 'detail', id],
    `attendance/${id}`,
    { enabled: id !== '' },
  );
  const isLoading = attendanceData === undefined && queryError === undefined;

  /**
   * The form is seeded from the record.
   *
   * The values are handed to the form itself, so the form follows the record
   * without a copy of it in state and without a write in an effect.
   */
  const seededValues = useMemo<FormData | undefined>(() => {
    if (!attendanceData) return undefined;
    const status = STATUS_VALUES.includes(attendanceData.status)
      ? (attendanceData.status as FormData['status'])
      : 'present';
    return {
      date: attendanceData.date ? String(attendanceData.date).slice(0, 10) : '',
      status,
      checkInTime: toTimeInputValue(attendanceData.checkInTime ?? attendanceData.checkIn),
      checkOutTime: toTimeInputValue(attendanceData.checkOutTime ?? attendanceData.checkOut),
      notes: attendanceData.notes ?? '',
    };
  }, [attendanceData]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: seededValues,
  });
  const watchedDate = useWatch({ control, name: 'date' }) ?? '';

  const checkIn = useWatch({ control, name: 'checkInTime' });
  const checkOut = useWatch({ control, name: 'checkOutTime' });
  const status = useWatch({ control, name: 'status' });
  const dateValue = useWatch({ control, name: 'date' });

  const computedHours = computeHoursRange(checkIn, checkOut);

  const tenantIdForCheck =
    attendanceData?.tenant?._id ??
    (typeof attendanceData?.tenantId === 'object' ? attendanceData?.tenantId?._id : undefined) ??
    '';
  const originalDate = attendanceData?.date ? String(attendanceData.date).slice(0, 10) : '';
  const dateChanged = dateValue !== '' && dateValue !== originalDate;

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    setClash(null);
    try {
      // A record is one resident on one day: the server holds a unique index
      // on that pair (apps/api/src/models/attendanceRecord.ts:74), so a move
      // to a day that already holds a record of this resident is refused.
      if (dateChanged && tenantIdForCheck !== '') {
        const params = new URLSearchParams();
        params.set('date', data.date);
        params.set('tenantId', tenantIdForCheck);
        params.set('limit', '5');
        const existing = await api.get(`attendance?${params.toString()}`).json<{
          success: boolean;
          data: ClashRow[];
        }>();
        const other = (existing.data ?? []).find((row) => row._id !== id);
        if (other) {
          setClash(other);
          setSubmitError(
            `This resident already has a record on ${other.date}. The server holds one record per resident per day, so the move is refused.`,
          );
          return;
        }
      }
      await api.put(`attendance/${id}`, { json: data }).json();
      // The record the operator lands on is the record the server holds.
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      router.push(`/attendance/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const tenantMapped = attendanceData?.tenant;
  const tenantRaw = attendanceData?.tenantId;
  const tenantName = tenantMapped?.user?.name ?? tenantRaw?.userId?.name ?? 'Unknown resident';
  const roomNumber = tenantMapped?.room?.roomNumber ?? tenantRaw?.roomId?.roomNumber ?? 'no room';
  const bedId = tenantRaw?.bedId ?? attendanceData?.bedId ?? '?';
  const hasTenant = Boolean(tenantMapped || tenantRaw);
  const err = errors as Record<string, { message?: string }>;
  const loadError = errorMessage(queryError);

  return (
    <FormPage
      title="Correct an attendance record"
      description="Change the day, the status, the times or the note of one record"
      backHref={id ? `/attendance/${id}` : '/attendance'}
      error={submitError !== '' ? submitError : loadError}
      isLoading={isLoading}
      maxWidth="form"
    >
      <div className="space-y-5">
        {hasTenant && (
          <DetailCard title="The record you are correcting" icon={<UserRound />}>
            <DetailList>
              <DetailRow label="Resident" value={tenantName} />
              <DetailRow
                label="Room"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    {roomNumber} · Bed {bedId}
                  </span>
                }
              />
              {tenantIdForCheck !== '' && (
                <DetailRow
                  label="Resident record"
                  value={
                    <button
                      type="button"
                      onClick={() => router.push(`/tenants/${tenantIdForCheck}`)}
                      className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) hover:underline"
                    >
                      View resident
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              )}
              {attendanceData && (
                <DetailRow
                  label="As the server holds it"
                  value={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <StatusBadge
                        variant={statusToVariant(attendanceData.status)}
                        label={STATUS_LABELS[attendanceData.status] ?? attendanceData.status}
                      />
                      <span className="text-xs text-(--color-text-muted)">
                        {String(attendanceData.date).slice(0, 10)} · in{' '}
                        {formatClock(attendanceData.checkInTime ?? attendanceData.checkIn)} · out{' '}
                        {formatClock(attendanceData.checkOutTime ?? attendanceData.checkOut)}
                      </span>
                    </span>
                  }
                />
              )}
            </DetailList>
          </DetailCard>
        )}

        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              disabled={clash !== null}
              cancelHref={id ? `/attendance/${id}` : '/attendance'}
              submitLabel="Save the correction"
              divided={false}
            />
          }
        >
          <div className="space-y-6">
            <FormSection title="The day and the mark" description="Which day, and what it says">
              <FormGrid>
                <DatePicker
                  label="Date"
                  error={err.date?.message}
                  name="date"
                  value={watchedDate}
                  onChange={(value) => setValue('date', value, { shouldValidate: true })}
                />
                <Select
                  label="Status"
                  options={statusOptions}
                  error={err.status?.message}
                  {...register('status')}
                />
              </FormGrid>
              {dateChanged && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-(--color-warning-700)">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The day moves. The server holds one record per resident per day, so the save is
                  refused when the resident already has a record on the new day.
                </p>
              )}
              {clash !== null && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-(--color-danger-700)">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The resident already has a record on {clash.date} (
                  {STATUS_LABELS[clash.status] ?? clash.status}).{' '}
                  <Link
                    href={`/attendance/${clash._id}`}
                    className="underline underline-offset-2 hover:text-(--color-brand-600)"
                  >
                    Open that record
                  </Link>
                  .
                </p>
              )}
              {status === 'on_leave' && (
                <p className="mt-2 text-xs text-(--color-text-muted)">
                  An on-leave day is normally written by the approval of a leave. If you write it by
                  hand, name the leave in the notes so the office can find it again.
                </p>
              )}
            </FormSection>

            <FormSection title="Timing" description="Check-in/out times and duration" divided>
              <FormGrid>
                <Input
                  label="Check-in time"
                  type="time"
                  error={err.checkInTime?.message}
                  leftIcon={<Clock className="h-4 w-4" />}
                  {...register('checkInTime')}
                />
                <Input
                  label="Check-out time"
                  type="time"
                  error={err.checkOutTime?.message}
                  leftIcon={<Clock className="h-4 w-4" />}
                  {...register('checkOutTime')}
                />
              </FormGrid>

              {computedHours !== '' && (
                <div className="mt-3 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2 text-sm font-semibold text-(--color-text-secondary)">
                  Duration: <span className="text-(--color-text-primary)">{computedHours}</span>
                  {' · '}
                  In: {checkIn || '--:--'} · Out: {checkOut || '--:--'}
                </div>
              )}
            </FormSection>

            <FormSection title="Notes" description="Optional context (max 500)" divided>
              <FormFullWidth>
                <Textarea
                  label="Notes"
                  rows={3}
                  placeholder="Optional notes, e.g. leave reference or correction reason..."
                  error={err.notes?.message}
                  {...register('notes')}
                />
              </FormFullWidth>
              {attendanceData?.recordedBy && (
                <p className="text-xs text-(--color-text-muted)">
                  Recorded by {attendanceData.recordedBy.name ?? 'the gate'}
                  {attendanceData.updatedAt
                    ? ` · Last changed ${String(attendanceData.updatedAt).slice(0, 10)}`
                    : ''}
                </p>
              )}
            </FormSection>
          </div>
        </FormCard>

        {/* What the save commits, and what it does not. */}
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
            <Info className="h-4 w-4 text-(--color-brand-600)" />
            What this save does
          </p>
          <ul className="text-2xs mt-2 space-y-1 font-medium text-(--color-text-secondary)">
            <li>
              The server rewrites the day, the status, the two times and the note of this one
              record, and writes an update entry in the audit log with the fields that changed
              (apps/api/src/routes/attendance.ts:650-704).
            </li>
            <li>
              It changes no money. Nothing in the server reads an attendance mark when it raises a
              bill: what a resident owes comes from the rent on their own record
              (apps/api/src/services/invoice.service.ts:97). A correction of a mark moves no charge
              and creates no invoice.
            </li>
            <li>
              The resident is not told. The server sends no message for a correction: the resident
              sees the corrected row in their attendance history the next time they open the app.
            </li>
            <li>
              The mark you write here is the mark the day carries. A day that says the resident
              never came back while it carries their sign-in is a record that disagrees with itself,
              and the day board names it.
            </li>
          </ul>
        </div>
      </div>
    </FormPage>
  );
}
