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

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  breakfast: z.string().optional(),
  lunch: z.string().optional(),
  dinner: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewMenuPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { breakfast: '', lunch: '', dinner: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('menus', { json: data }).json<{ success: boolean }>();
      router.push('/menus');
    } catch {
      setSubmitError('Failed to create menu. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Menu</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Plan a daily meal menu</p>
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
          <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="breakfast"
              className="text-surface-800 font-display text-sm font-semibold"
            >
              Breakfast
            </label>
            <textarea
              id="breakfast"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="e.g. Idli, Dosa, Chutney, Sambar..."
              {...register('breakfast')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lunch" className="text-surface-800 font-display text-sm font-semibold">
              Lunch
            </label>
            <textarea
              id="lunch"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="e.g. Rice, Dal, Sabzi, Roti..."
              {...register('lunch')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dinner" className="text-surface-800 font-display text-sm font-semibold">
              Dinner
            </label>
            <textarea
              id="dinner"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="e.g. Chapati, Paneer, Dal, Rice..."
              {...register('dinner')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Menu
          </Button>
        </div>
      </form>
    </div>
  );
}
