'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['present', 'absent', 'on_leave', 'not_returned']),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  // QR flow not implemented for admin manual entry yet — keep app + manual only
  method: z.enum(['manual', 'app']),
  notes: z.string().optional(),
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
];

interface TenantOption {
  _id: string;
  user?: { name: string; phone: string };
  room?: { roomNumber: string };
  bedId?: string;
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
    defaultValues: { checkIn: '', checkOut: '', notes: '', method: 'manual' },
  });

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
    } catch {
      setSubmitError('Failed to record attendance. Please try again.');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Record Attendance"
      description="Mark attendance for a tenant"
      backHref="/attendance"
      error={submitError}
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
                labelKey={(item) => {
                  const t = item as unknown as TenantOption;
                  return t.user?.name ?? 'Unknown';
                }}
                sublabelFn={(item) => {
                  const t = item as unknown as TenantOption;
                  return `Room ${t.room?.roomNumber ?? 'N/A'} · Bed ${t.bedId ?? 'N/A'}`;
                }}
                dataPath="data"
              />
            )}
          />
          <FormGrid>
            <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              error={errors.status?.message}
              {...register('status')}
            />
          </FormGrid>
          <FormGrid>
            <Input
              label="Check-in Time"
              type="time"
              error={errors.checkIn?.message}
              {...register('checkIn')}
            />
            <Input
              label="Check-out Time"
              type="time"
              error={errors.checkOut?.message}
              {...register('checkOut')}
            />
          </FormGrid>
          <Select
            label="Method"
            options={METHOD_OPTIONS}
            error={errors.method?.message}
            {...register('method')}
          />
          <Textarea
            label="Notes"
            rows={3}
            placeholder="Optional notes..."
            error={errors.notes?.message}
            {...register('notes')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}
