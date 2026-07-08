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
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.coerce.number().min(0, 'Must be >= 0').optional(),
  status: z.enum(['booked', 'completed', 'cancelled']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EditLaundrySlotPage() {
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
    api.get(`laundry-slots/${id}`).json<{ success: boolean; data: FormData & { _id: string } }>()
      .then((res) => {
        const d = res.data;
        reset({
          slotDate: d.slotDate ?? '',
          slotTime: d.slotTime ?? '',
          items: d.items ?? 0,
          status: (d.status as 'booked' | 'completed' | 'cancelled') ?? 'booked',
          notes: d.notes ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => { setSubmitError('Failed to load laundry slot'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`laundry-slots/${id}`, { json: data }).json();
      router.push('/laundry');
    } catch {
      setSubmitError('Failed to update laundry slot');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-display text-[color:var(--color-surface-900)] text-2xl font-extrabold">Edit Laundry Slot</h2>
          <p className="text-[color:var(--color-surface-500)] mt-0.5 text-sm">Update laundry slot details</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Slot Date" type="date" error={errors.slotDate?.message} {...register('slotDate')} />
            <Input label="Slot Time" type="time" error={errors.slotTime?.message} {...register('slotTime')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Items" type="number" error={errors.items?.message} {...register('items')} />
            <Select label="Status" options={STATUS_OPTIONS} error={errors.status?.message} {...register('status')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[color:var(--color-surface-800)] font-display text-sm font-semibold">Notes</label>
            <textarea rows={3} className="font-[family:var(--font-body)] focus:ring-[length:var(--bw-strong)] focus:ring-[color:var(--color-brand-500)] w-full rounded-[var(--radius-md)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base text-[color:var(--color-surface-900)] focus:outline-none focus:ring-offset-2" placeholder="Optional notes..." {...register('notes')} />
          </div>
        </div>
        <div className="border-t-[length:var(--bw-default)] border-t-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
