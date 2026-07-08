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
import { Textarea } from '@/components/ui/Textarea';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
  status: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EditLeavePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api.get(`leaves/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load leave application'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`leaves/${id}`, { json: data }).json();
      router.push('/leaves');
    } catch {
      setSubmitError('Failed to update leave application');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Leave Application</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update leave details</p>
        </div>
      </div>
      {submitError && <ErrorBanner message={submitError} />}
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Start Date" type="date" error={errors.startDate?.message} {...register('startDate')} />
            <Input label="End Date" type="date" error={errors.endDate?.message} {...register('endDate')} />
          </div>
          <Textarea label="Reason" rows={3} error={errors.reason?.message} placeholder="Enter reason..." {...register('reason')} />
          <Select label="Status" options={statusOptions} error={errors.status?.message} {...register('status')} />
        </div>
        <div className="border-t-[length:var(--bw-strong)] border-t-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
