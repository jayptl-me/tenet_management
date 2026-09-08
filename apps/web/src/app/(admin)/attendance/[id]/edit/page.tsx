'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock, UserRound, Hash, ExternalLink, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
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
    date: z.string().min(1, 'Date is required'),
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

interface AttendanceDetail {
  _id: string;
  date: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
  bedId?: string;
  recordedBy?: { _id: string; name: string } | null;
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

export default function EditAttendancePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceDetail | null>(null);
  const [originalDate, setOriginalDate] = useState('');
  const [computedHours, setComputedHours] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const checkIn = useWatch({ control, name: 'checkInTime' });
  const checkOut = useWatch({ control, name: 'checkOutTime' });
  const status = useWatch({ control, name: 'status' });
  const dateValue = useWatch({ control, name: 'date' });

  useEffect(() => {
    if (checkIn && checkOut) {
      const [inH, inM] = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);
      const totalMinutes = outH * 60 + outM - (inH * 60 + inM);
      if (totalMinutes >= 0) {
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        setComputedHours(`${hours}h ${mins}m`);
      } else {
        setComputedHours('Invalid (out < in) — fix before saving');
      }
    } else {
      setComputedHours('');
    }
  }, [checkIn, checkOut]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`attendance/${id}`)
      .json<{ success: boolean; data: AttendanceDetail }>()
      .then((res) => {
        setAttendanceData(res.data);
        const d = res.data;
        const ymd = d.date ? String(d.date).slice(0, 10) : '';
        setOriginalDate(ymd);
        reset({
          date: ymd,
          status: (d.status as FormData['status']) ?? 'present',
          checkInTime: toTimeInputValue(d.checkInTime ?? d.checkIn),
          checkOutTime: toTimeInputValue(d.checkOutTime ?? d.checkOut),
          notes: d.notes ?? '',
        });
        setIsLoading(false);
      })
      .catch(async (err) => {
        setSubmitError((await parseApiError(err)).message);
        setIsLoading(false);
      });
  }, [id, reset]);

  const tenantIdForCheck =
    attendanceData?.tenant?._id ??
    (typeof attendanceData?.tenantId === 'object' ? attendanceData?.tenantId?._id : undefined) ??
    '';

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      if (data.date !== originalDate && tenantIdForCheck !== '') {
        const params = new URLSearchParams();
        params.set('date', data.date);
        params.set('tenantId', tenantIdForCheck);
        params.set('limit', '5');
        const existing = await api.get(`attendance?${params.toString()}`).json<{
          success: boolean;
          data: Array<{ _id: string }>;
        }>();
        const clash = (existing.data ?? []).find((r) => r._id !== id);
        if (clash) {
          setSubmitError(
            'Another attendance record already exists for this tenant on the new date.',
          );
          return;
        }
      }
      await api.put(`attendance/${id}`, { json: data }).json();
      router.push(`/attendance/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const tenantMapped = attendanceData?.tenant;
  const tenantRaw = attendanceData?.tenantId;
  const tenantName = tenantMapped?.user?.name ?? tenantRaw?.userId?.name ?? 'N/A';
  const roomNumber = tenantMapped?.room?.roomNumber ?? tenantRaw?.roomId?.roomNumber ?? 'N/A';
  const bedId = tenantRaw?.bedId ?? attendanceData?.bedId ?? 'N/A';
  const hasTenant = Boolean(tenantMapped || tenantRaw);
  const err = errors as Record<string, { message?: string }>;
  const dateChanged = dateValue !== undefined && dateValue !== '' && dateValue !== originalDate;

  return (
    <FormPage
      title="Edit Attendance Record"
      description="Update attendance status, check-in/out times, and notes"
      backHref={id ? `/attendance/${id}` : '/attendance'}
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {hasTenant && (
          <DetailCard title="Tenant" icon={<UserRound />}>
            <DetailList>
              <DetailRow label="Name" value={tenantName} />
              <DetailRow
                label="Room"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {roomNumber} · Bed {bedId}
                  </span>
                }
              />
              {tenantIdForCheck !== '' && (
                <DetailRow
                  label="Tenant"
                  value={
                    <button
                      type="button"
                      onClick={() => router.push(`/tenants/${tenantIdForCheck}`)}
                      className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-brand-600)] hover:underline"
                    >
                      View tenant
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              )}
              {attendanceData && (
                <DetailRow
                  label="Current"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <StatusBadge
                        variant={statusToVariant(attendanceData.status)}
                        label={attendanceData.status.replace(/_/g, ' ')}
                      />
                      <span className="text-xs text-[color:var(--color-text-muted)]">
                        {String(attendanceData.date).slice(0, 10)}
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
              cancelHref={id ? `/attendance/${id}` : '/attendance'}
              submitLabel="Save Changes"
              divided={false}
            />
          }
        >
          <div className="space-y-6">
            <FormSection title="Record" description="Date and presence status">
              <FormGrid>
                <DatePicker
                  label="Date"
                  error={err.date?.message}
                  {...register('date')}
                />
                <Select
                  label="Status"
                  options={statusOptions}
                  error={err.status?.message}
                  {...register('status')}
                />
              </FormGrid>
              {dateChanged && (
                <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[color:var(--color-warning-700)]">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Date changed — duplicate check runs on save. Another record for this tenant on the
                  new date will block the update.
                </p>
              )}
              {status === 'on_leave' && (
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                  On-leave rows are normally created by leave approval. Editing to on-leave should
                  reference the covering leave in notes.
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
                <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--color-text-secondary)]">
                  Duration:{' '}
                  <span className="text-[color:var(--color-text-primary)]">{computedHours}</span>
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
                <p className="text-xs text-[color:var(--color-text-muted)]">
                  Recorded by {attendanceData.recordedBy.name ?? 'System'}
                  {attendanceData.updatedAt
                    ? ` · Updated ${String(attendanceData.updatedAt).slice(0, 10)}`
                    : ''}
                </p>
              )}
            </FormSection>
          </div>
        </FormCard>
      </div>
    </FormPage>
  );
}
