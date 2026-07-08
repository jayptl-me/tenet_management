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
  mealType: z.string().min(1, 'Meal type is required'),
  rating: z.coerce.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

const mealTypeOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const statusOptions = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'actioned', label: 'Actioned' },
];

export default function EditMealPage() {
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
    api.get(`meals/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load meal feedback'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`meals/${id}`, { json: data }).json();
      router.push('/meals');
    } catch {
      setSubmitError('Failed to update meal feedback');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Meal Feedback</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update meal feedback details</p>
        </div>
      </div>
      {submitError && <ErrorBanner message={submitError} />}
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <Select label="Meal Type" options={mealTypeOptions} error={errors.mealType?.message} {...register('mealType')} />
          <Input label="Rating (1-5)" type="number" min={1} max={5} error={errors.rating?.message} {...register('rating')} />
          <Input label="Comment" error={errors.comment?.message} {...register('comment')} />
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
