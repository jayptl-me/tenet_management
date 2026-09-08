'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarDays, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
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

const schema = z
  .object({
    tenantId: z.string().min(1, 'Tenant is required'),
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

interface TenantOption {
  _id: string;
  user?: { name: string; phone: string };
  room?: { roomNumber: string };
  bedId?: string;
}

function durationLabel(checkIn: string | undefined, checkOut: string | undefined): string {
  if (!checkIn || !checkOut) return '';
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  if ([inH, inM, outH, outM].some((n) => Number.isNaN(n))) return '';
  const total = outH * 60 + outM - (inH * 60 + inM);
  if (total < 0) return 'Invalid (out < in)';
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

export default function NewAttendancePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { checkIn: '', checkOut: '', notes: '', method: 'manual', status: 'present' },
  });

  const checkIn = useWatch({ control, name: 'checkIn' });
  const checkOut = useWatch({ control, name: 'checkOut' });
  const duration = durationLabel(checkIn, checkOut);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = {
      ...data,
      checkIn: data.checkIn || undefined,
      checkOut: data.checkOut || undefined,
      notes: data.notes || undefined,
    };
    try {
      await api.post('attendance/manual', { json: payload }).json<{ success: boolean }>();
      router.push('/attendance');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Record Attendance"
      description="Mark attendance for a tenant"
      backHref="/attendance"
      error={submitError}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/attendance"
            submitLabel="Record Attendance"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <FormSection title="Tenant" description="Who is this record for">
            <FormFullWidth>
              <Controller
                name="tenantId"
                control={control}
                render={({ field }) => (
                  <ResourceSelect
                    label="Tenant"
                    endpoint="tenants?isActive=true"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select tenant..."
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
                {...register('date')}
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
              <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--color-text-secondary)]">
                Duration: <span className="text-[color:var(--color-text-primary)]">{duration}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
              On-leave rows are created automatically when a leave is approved. Manual on-leave
              entries should reference the leave in notes.
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
    </FormPage>
  );
}
