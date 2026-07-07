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

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  type: z.string().min(1, 'Type is required'),
  targetType: z.string().min(1, 'Target type is required'),
});

type FormData = z.infer<typeof schema>;

const typeOptions = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'payment_verified', label: 'Payment Verified' },
  { value: 'complaint_update', label: 'Complaint Update' },
  { value: 'service_update', label: 'Service Update' },
  { value: 'electricity_bill', label: 'Electricity Bill' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'meal_feedback', label: 'Meal Feedback' },
];

const targetTypeOptions = [
  { value: 'all', label: 'All Tenants' },
  { value: 'floor', label: 'By Floor' },
  { value: 'room', label: 'By Room' },
  { value: 'individual', label: 'Specific Tenant' },
];

export default function EditNotificationPage() {
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
    api.get(`notifications/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load notification'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`notifications/${id}`, { json: data }).json();
      router.push('/notifications');
    } catch {
      setSubmitError('Failed to update notification');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Edit Notification</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Update notification details</p>
        </div>
      </div>
      {submitError && <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">{submitError}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <Input label="Title" error={errors.title?.message} {...register('title')} />
          <div className="flex flex-col gap-1.5">
            <label className="text-surface-800 font-display text-sm font-semibold">Body</label>
            <textarea rows={4} className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)]" placeholder="Enter body..." {...register('body')} />
          </div>
          <Select label="Type" options={typeOptions} error={errors.type?.message} {...register('type')} />
          <Select label="Target" options={targetTypeOptions} error={errors.targetType?.message} {...register('targetType')} />
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
