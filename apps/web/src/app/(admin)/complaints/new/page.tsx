'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  roomId: z.string().min(1, 'Room is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum([
    'wifi', 'water', 'electricity', 'food_quality', 'cleaning_room',
    'cleaning_washroom', 'washing_machine', 'fridge', 'lights', 'noise', 'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type FormData = z.infer<typeof schema>;

const CATEGORY_OPTIONS = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'cleaning_room', label: 'Cleaning - Room' },
  { value: 'cleaning_washroom', label: 'Cleaning - Washroom' },
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'lights', label: 'Lights' },
  { value: 'noise', label: 'Noise' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function NewComplaintPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { description: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('complaints', { json: data }).json<{ success: boolean }>();
      router.push('/complaints');
    } catch {
      setSubmitError('Failed to create complaint. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Complaint</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Register a new tenant complaint</p>
        </div>
      </div>

      {submitError && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="tenantId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Tenant"
                  endpoint="tenants"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select tenant..."
                  error={errors.tenantId?.message}
                />
              )}
            />
            <Controller
              name="roomId"
              control={control}
              render={({ field }) => (
                <ResourceSelect
                  label="Room"
                  endpoint="rooms"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select room..."
                  error={errors.roomId?.message}
                />
              )}
            />
          </div>
          <Input label="Title" placeholder="Brief description of the issue" error={errors.title?.message} {...register('title')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Category" options={CATEGORY_OPTIONS} error={errors.category?.message} {...register('category')} />
            <Select label="Priority" options={PRIORITY_OPTIONS} error={errors.priority?.message} {...register('priority')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-surface-800 font-display text-sm font-semibold">Description</label>
            <textarea id="description" rows={5}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Detailed description of the complaint..."
              {...register('description')}
            />
            {errors.description && <p className="text-danger-600 text-sm font-medium">{errors.description.message}</p>}
          </div>
        </div>
        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" />Save Complaint</Button>
        </div>
      </form>
    </div>
  );
}
