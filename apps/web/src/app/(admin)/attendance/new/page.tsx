'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Clock, Info, TriangleAlert, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { useApiQuery } from '@/hooks/useApiQuery';
import { tenantLabel } from '@/lib/resource-select-presets';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

const schema = z
  .object({
    tenantId: z.string().min(1, 'Resident is required'),
    date: z
      .string()
      .min(1, 'Date is required')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    status: z.enum(['present', 'absent', 'on_leave', 'not_returned']),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    method: z.enum(['manual', 'app', 'qr']),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.checkIn !== undefined &&
      data.checkIn !== '' &&
      data.checkOut !== undefined &&
      data.checkOut !== ''
    ) {
      if (data.checkOut < data.checkIn) {
        ctx.addIssue({
          code: 'custom',
          path: ['checkOut'],
          message: 'Check-out must be after check-in',
        });
      }
    }
  });
type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'not_returned', label: 'Not Returned' },
];

const METHOD_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'app', label: 'Mobile App' },
  { value: 'qr', label: 'QR Scan' },
];

const STATUS_LABELS: Record<string, string> = {
  present: 'present',
  absent: 'absent',
  on_leave: 'on leave',
  not_returned: 'not returned',
};

interface TenantOption {
  _id: string;
  user?: { name?: string; phone?: string };
  room?: { roomNumber?: string };
  bedId?: string;
}

interface ExistingRecord {
  _id: string;
  date: string;
  status: string;
  method?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  recordedBy?: { name?: string } | null;
}

interface TenantRow {
  _id: string;
  user?: { name?: string } | null;
  room?: { roomNumber?: string } | null;
  bedId?: string | null;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function durationLabel(checkIn: string | undefined, checkOut: string | undefined): string {
  if (!checkIn || !checkOut) return '';
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  if ([inH, inM, outH, outM].some((n) => Number.isNaN(n))) return '';
  const total = outH * 60 + outM - (inH * 60 + inM);
  if (total < 0) return 'Invalid (out before in)';
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

export default function NewAttendancePage() {
  return (
    <Suspense
      fallback={
        <FormPage
          title="Mark attendance"
          description="Write one record for one resident on one day"
          backHref="/attendance"
          isLoading
          maxWidth="form"
        >
          {null}
        </FormPage>
      }
    >
      <AttendanceForm />
    </Suspense>
  );
}

function AttendanceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');

  // The link that brought the office here may name the resident and the day.
  const rawTenant = searchParams.get('tenantId') ?? '';
  const rawDate = searchParams.get('date') ?? '';
  const urlDate = YMD.test(rawDate) ? rawDate : '';

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: rawTenant,
      date: urlDate,
      status: 'present',
      checkIn: '',
      checkOut: '',
      method: 'manual',
      notes: '',
    },
  });
  const watchedDate = useWatch({ control, name: 'date' }) ?? '';

  const checkIn = useWatch({ control, name: 'checkIn' });
  const checkOut = useWatch({ control, name: 'checkOut' });
  const status = useWatch({ control, name: 'status' });
  const dateValue = useWatch({ control, name: 'date' });
  const tenantId = useWatch({ control, name: 'tenantId' });
  const duration = durationLabel(checkIn, checkOut);

  /**
   * The resident of the record.
   *
   * The server holds the name, the room and the bed, so the form does not
   * carry a name of its own.
   */
  const tenantQuery = useApiQuery<TenantRow>(
    ['tenants', 'attendance-new', tenantId],
    `tenants/${tenantId}`,
    { enabled: tenantId !== '' },
  );
  const residentName = tenantQuery.data?.user?.name ?? '';
  const residentWhere =
    tenantQuery.data === undefined
      ? ''
      : `Room ${tenantQuery.data.room?.roomNumber ?? 'N/A'} · Bed ${tenantQuery.data.bedId ?? 'N/A'}`;

  /**
   * The record that already exists for this resident and this day.
   *
   * The server refuses a second record for the same resident and day
   * (apps/api/src/routes/attendance.ts:240-245), so the form checks first and
   * shows the record that is in the way instead of writing over it.
   */
  const clashQuery = useApiQuery<ExistingRecord[]>(
    ['attendance', 'clash', tenantId, dateValue],
    `attendance?tenantId=${tenantId}&date=${dateValue}&limit=5`,
    { enabled: tenantId !== '' && dateValue !== '' && YMD.test(dateValue) },
  );
  const existing = clashQuery.data?.[0] ?? null;

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = {
      ...data,
      checkIn: data.checkIn || undefined,
      checkOut: data.checkOut || undefined,
      notes: data.notes || undefined,
    };
    try {
      const res = await api
        .post('attendance/manual', { json: payload })
        .json<{ success: boolean; data: { _id?: string } }>();
      const recordId = res.data?._id ?? '';
      router.push(recordId === '' ? '/attendance' : `/attendance/${recordId}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const residentLabel = residentName === '' ? 'the resident' : residentName;
  const dayLabel = dateValue === '' ? 'the day you pick' : dateValue;

  return (
    <FormPage
      title="Mark attendance"
      description="Write one record for one resident on one day"
      backHref="/attendance"
      error={submitError}
      maxWidth="form"
    >
      <div className="space-y-5">
        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              disabled={existing !== null}
              cancelHref="/attendance"
              submitLabel="Write the record"
              divided={false}
            />
          }
        >
          <div className="space-y-5">
            <FormSection title="Resident" description="Who is this record for">
              <FormFullWidth>
                <Controller
                  name="tenantId"
                  control={control}
                  render={({ field }) => (
                    <ResourceSelect
                      label="Resident"
                      endpoint="tenants?isActive=true"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select resident..."
                      error={err.tenantId?.message}
                      valueKey="_id"
                      labelKey={tenantLabel}
                      sublabelFn={(item) => {
                        const t = item as unknown as TenantOption;
                        return `Room ${t.room?.roomNumber ?? 'N/A'} · Bed ${t.bedId ?? 'N/A'}`;
                      }}
                      dataPath="data"
                    />
                  )}
                />
              </FormFullWidth>
            </FormSection>

            <FormSection title="Presence" description="Date, status, and timing">
              <FormGrid>
                <DatePicker
                  label="Date"
                  error={errors.date?.message}
                  leftIcon={<CalendarDays className="h-4 w-4" />}
                  name="date"
                  value={watchedDate}
                  onChange={(value) => setValue('date', value, { shouldValidate: true })}
                />
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  error={errors.status?.message}
                  {...register('status')}
                />
                <Input
                  label="Check-in Time"
                  type="time"
                  error={errors.checkIn?.message}
                  leftIcon={<Clock className="h-4 w-4" />}
                  {...register('checkIn')}
                />
                <Input
                  label="Check-out Time"
                  type="time"
                  error={errors.checkOut?.message}
                  leftIcon={<Clock className="h-4 w-4" />}
                  {...register('checkOut')}
                />
              </FormGrid>
              {duration !== '' && (
                <div className="mt-3 rounded-(--radius-md) border border-(--border-color) bg-(--color-field-bg) px-3 py-2 text-sm font-semibold text-(--color-text-secondary)">
                  Duration: <span className="text-(--color-text-primary)">{duration}</span>
                </div>
              )}
              <p className="mt-2 text-xs text-(--color-text-muted)">
                A leave day is normally written by the approval of the leave: the server marks every
                day of the range as on leave unless the resident was on site that day. A leave you
                write by hand should name the leave in the notes.
              </p>
            </FormSection>

            <FormSection title="Recording" description="Method and notes">
              <FormGrid>
                <Select
                  label="Method"
                  options={METHOD_OPTIONS}
                  error={errors.method?.message}
                  {...register('method')}
                />
              </FormGrid>
              <FormFullWidth>
                <Textarea
                  label="Notes (max 500)"
                  rows={3}
                  placeholder="Optional notes, e.g. leave reference..."
                  error={errors.notes?.message}
                  {...register('notes')}
                />
              </FormFullWidth>
            </FormSection>
          </div>
        </FormCard>

        {existing !== null && (
          <div className="rounded-(--radius-lg) border border-(--color-danger-200) bg-(--color-danger-50) p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-(--color-danger-700)">
              <TriangleAlert className="h-4 w-4" />
              This resident already has a record for this day
            </p>
            <p className="text-2xs mt-1 font-medium text-(--color-danger-800)">
              The server holds a record for this resident on {existing.date}:{' '}
              <StatusBadge
                variant={statusToVariant(existing.status)}
                label={STATUS_LABELS[existing.status] ?? existing.status}
              />{' '}
              in at {formatClock(existing.checkInTime ?? existing.checkIn)}, out at{' '}
              {formatClock(existing.checkOutTime ?? existing.checkOut)}
              {existing.recordedBy?.name ? `, recorded by ${existing.recordedBy.name}` : ''}. The
              server refuses a second record for the same resident and day, so this form will not
              write over it.
            </p>
            <Link
              href={`/attendance/${existing._id}`}
              className="text-2xs mt-2 inline-block font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
            >
              Open the record that is already there
            </Link>
          </div>
        )}

        {/* What the save commits, and what it does not. */}
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-(--color-text-primary)">
            <Info className="h-4 w-4 text-(--color-brand-600)" />
            What this write does
          </p>
          <ul className="text-2xs mt-2 space-y-1 font-medium text-(--color-text-secondary)">
            <li>
              <strong className="text-(--color-text-primary)">
                One record: {residentLabel} on {dayLabel}, marked {STATUS_LABELS[status] ?? status}.
              </strong>{' '}
              The server writes it with your name on it, adds a create entry in the audit log, and
              refuses a second record for the same resident and day.
            </li>
            <li>
              The resident sees this row in their attendance history the next time they open the
              app. Nothing is sent to them: the server sends no message for a manual mark.
            </li>
            <li>
              An absent mark does not change what the resident owes. Nothing in the server reads an
              attendance mark when it raises a bill: the bill comes from the rent on the resident
              record.
            </li>
            {residentWhere !== '' && (
              <li className="flex items-center gap-1">
                <UserRound className="h-3 w-3" />
                {residentLabel} · {residentWhere}
              </li>
            )}
          </ul>
        </div>
      </div>
    </FormPage>
  );
}
