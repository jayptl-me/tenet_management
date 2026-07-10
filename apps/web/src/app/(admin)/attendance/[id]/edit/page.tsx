'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Clock, UserRound, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['present', 'absent', 'on_leave', 'not_returned']),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  notes: z.string().optional(),
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
  notes?: string;
  tenantId?: {
    _id?: string;
    userId?: { name?: string };
    roomId?: { roomNumber?: string };
    bedId?: string;
  };
  createdAt: string;
}

export default function EditAttendancePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceDetail | null>(null);
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

  // Compute hours when check-in/check-out change
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
        setComputedHours('Invalid (out < in)');
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
        reset({
          date: d.date ? String(d.date).slice(0, 10) : '',
          status: (d.status as FormData['status']) ?? 'present',
          checkInTime: d.checkInTime ?? '',
          checkOutTime: d.checkOutTime ?? '',
          notes: d.notes ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load attendance record');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`attendance/${id}`, { json: data }).json();
      router.push('/attendance');
    } catch {
      setSubmitError('Failed to update attendance record');
    }
  };

  const tenant = attendanceData?.tenantId;
  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Attendance Record"
      description="Update attendance status, check-in/out times, and notes"
      backHref="/attendance"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {tenant && (
          <DetailCard title="Tenant" icon={<UserRound />}>
            <DetailList>
              <DetailRow label="Name" value={tenant.userId?.name ?? 'N/A'} />
              <DetailRow
                label="Room"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {tenant.roomId?.roomNumber ?? 'N/A'} · Bed {tenant.bedId ?? 'N/A'}
                  </span>
                }
              />
            </DetailList>
          </DetailCard>
        )}

        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref="/attendance"
              submitLabel="Save Changes"
              divided={false}
            />
          }
        >
          <FormSection title="Attendance" description="Date, presence status, and timing">
            <FormGrid>
              <Input
                label="Date"
                type="date"
                error={err.date?.message}
                leftIcon={<CalendarDays className="h-4 w-4" />}
                {...register('date')}
              />
              <Select
                label="Status"
                options={statusOptions}
                error={err.status?.message}
                {...register('status')}
              />
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

            {computedHours && (
              <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--color-text-secondary)]">
                Duration:{' '}
                <span className="text-[color:var(--color-text-primary)]">{computedHours}</span>
                {' · '}
                In: {checkIn || '--:--'} · Out: {checkOut || '--:--'}
              </div>
            )}

            <FormFullWidth>
              <Textarea
                label="Notes"
                rows={2}
                placeholder="Optional notes..."
                error={err.notes?.message}
                {...register('notes')}
              />
            </FormFullWidth>
          </FormSection>
        </FormCard>
      </div>
    </FormPage>
  );
}
