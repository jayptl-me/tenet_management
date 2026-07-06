'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['present', 'absent', 'on_leave', 'not_returned']),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  method: z.enum(['manual', 'qr', 'app']),
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
  { value: 'qr', label: 'QR Code' },
  { value: 'app', label: 'Mobile App' },
];

export default function NewAttendancePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { checkIn: '', checkOut: '', notes: '' },
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
      await api.post('attendance', { json: payload }).json<{ success: boolean }>();
      router.push('/attendance');
    } catch {
      setSubmitError('Failed to record attendance. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">
            Record Attendance
          </h2>
          <p className="text-surface-500 mt-0.5 text-sm">Mark attendance for a tenant</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <Input
            label="Tenant ID"
            placeholder="Enter tenant ID"
            error={errors.tenantId?.message}
            {...register('tenantId')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              error={errors.status?.message}
              {...register('status')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
          <Select
            label="Method"
            options={METHOD_OPTIONS}
            error={errors.method?.message}
            {...register('method')}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-surface-800 font-display text-sm font-semibold">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Record Attendance
          </Button>
        </div>
      </form>
    </div>
  );
}
