'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  date: z.string().min(1, 'Required'),
  status: z.string().min(1, 'Required'),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  notes: z.string().optional(),
});


const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

type FormData = z.infer<typeof schema>;

export default function EditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`attendance/${id}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load data'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`attendance/${id}`, { json: data }).json();
      router.push('/attendance');
    } catch {
      setSubmitError('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Edit Attendance</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Update details</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <Input
            label="Date"
            type="string"
            error={errors.date?.message}
            {...register('date')}
          />
          <Select
            label="Status"
            options={statusOptions}
            error={errors.status?.message}
            {...register('status')}
          />
          <Input
            label="Check In Time"
            type="string"
            error={errors.checkInTime?.message}
            {...register('checkInTime')}
          />
          <Input
            label="Check Out Time"
            type="string"
            error={errors.checkOutTime?.message}
            {...register('checkOutTime')}
          />
          <Input
            label="Notes"
            type="string"
            error={errors.notes?.message}
            {...register('notes')}
          />
        </div>

        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
