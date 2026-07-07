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
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  rating: z.coerce.number().min(1, 'Min 1').max(5, 'Max 5'),
  comment: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const RATING_OPTIONS = [
  { value: '1', label: '1 Star' },
  { value: '2', label: '2 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '5', label: '5 Stars' },
];

export default function NewMealFeedbackPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 3, comment: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('meals', { json: data }).json<{ success: boolean }>();
      router.push('/meals');
    } catch {
      setSubmitError('Failed to submit feedback. Please try again.');
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
            New Meal Feedback
          </h2>
          <p className="text-surface-500 mt-0.5 text-sm">Record tenant meal feedback</p>
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
          <Input
            label="Tenant ID"
            placeholder="Enter tenant ID"
            error={errors.tenantId?.message}
            {...register('tenantId')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
            <Select
              label="Meal Type"
              options={MEAL_OPTIONS}
              error={errors.mealType?.message}
              {...register('mealType')}
            />
            <Select
              label="Rating"
              options={RATING_OPTIONS}
              error={errors.rating?.message}
              {...register('rating')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="comment"
              className="text-surface-800 font-display text-sm font-semibold"
            >
              Comment
            </label>
            <textarea
              id="comment"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Optional feedback..."
              {...register('comment')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Feedback
          </Button>
        </div>
      </form>
    </div>
  );
}
