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
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  pinned: z.boolean().optional(),
  targetType: z.enum(['all', 'floor', 'room']).optional(),
  targetIds: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TARGET_OPTIONS = [
  { value: 'all', label: 'All Tenants' },
  { value: 'floor', label: 'By Floor' },
  { value: 'room', label: 'By Room' },
];

export default function NewNoticePage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { content: '', pinned: false, targetIds: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const payload = {
      ...data,
      targetIds: data.targetIds
        ? data.targetIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    };
    try {
      await api.post('notices', { json: payload }).json<{ success: boolean }>();
      router.push('/notices');
    } catch {
      setSubmitError('Failed to post notice. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Post Notice</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Create a new announcement for tenants</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <Input
            label="Title"
            placeholder="Notice title"
            error={errors.title?.message}
            {...register('title')}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="content"
              className="text-surface-800 font-display text-sm font-semibold"
            >
              Content
            </label>
            <textarea
              id="content"
              rows={6}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Write the full notice content..."
              {...register('content')}
            />
            {errors.content && (
              <p className="text-danger-600 text-sm font-medium">{errors.content.message}</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Target"
              options={TARGET_OPTIONS}
              error={errors.targetType?.message}
              {...register('targetType')}
            />
            <Input
              label="Target IDs"
              placeholder="Comma-separated IDs (optional)"
              error={errors.targetIds?.message}
              {...register('targetIds')}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="text-brand-500 focus:ring-brand-500 h-5 w-5 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)] focus:ring-[length:var(--bw-default)]"
              {...register('pinned')}
            />
            <span className="text-surface-800 font-display text-sm font-semibold">
              Pin this notice
            </span>
          </label>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Post Notice
          </Button>
        </div>
      </form>
    </div>
  );
}
