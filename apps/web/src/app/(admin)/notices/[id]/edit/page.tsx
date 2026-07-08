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
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  pinned: z.boolean().optional(),
  isPublished: z.boolean(),
  targetType: z.enum(['all', 'floor', 'room']).optional(),
  targetIds: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TARGET_OPTIONS = [
  { value: 'all', label: 'All Tenants' },
  { value: 'floor', label: 'By Floor' },
  { value: 'room', label: 'By Room' },
];

export default function EditNoticePage() {
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
    defaultValues: { content: '', pinned: false, isPublished: false, targetIds: '' },
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`notices/${id}`)
      .json<{ success: boolean; data: Record<string, unknown> }>()
      .then((res) => {
        const d = res.data;
        reset({
          title: (d.title as string) ?? '',
          content: (d.content as string) ?? '',
          pinned: (d.pinned as boolean) ?? false,
          isPublished: (d.isPublished as boolean) ?? false,
          targetType: (d.targetType as 'all' | 'floor' | 'room') ?? 'all',
          targetIds: Array.isArray(d.targetIds)
            ? (d.targetIds as string[]).join(', ')
            : '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load notice');
        setIsLoading(false);
      });
  }, [id, reset]);

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
      await api.put(`notices/${id}`, { json: payload }).json();
      router.push('/notices');
    } catch {
      setSubmitError('Failed to update notice');
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">
            Edit Notice
          </h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">
            Update notice details
          </p>
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
            error={errors.title?.message}
            {...register('title')}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="content"
              className="font-[family:var(--font-display)] text-sm font-semibold text-[color:var(--color-text-secondary)]"
            >
              Content
            </label>
            <textarea
              id="content"
              rows={6}
              className="w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 font-[family:var(--font-body)] text-base text-[color:var(--color-text-primary)] focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-[color:var(--color-brand-500)] focus:ring-offset-2"
              placeholder="Write the full notice content..."
              {...register('content')}
            />
            {errors.content && (
              <p className="text-sm font-medium text-[color:var(--color-danger-600)]">
                {errors.content.message}
              </p>
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
              className="h-5 w-5 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)] text-[color:var(--color-brand-500)] focus:ring-[length:var(--bw-default)] focus:ring-[color:var(--color-brand-500)]"
              {...register('pinned')}
            />
            <span className="font-[family:var(--font-display)] text-sm font-semibold text-[color:var(--color-text-primary)]">
              Pin this notice
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register('isPublished')}
              className="h-5 w-5 rounded border-[length:var(--bw-default)] text-[color:var(--color-brand-500)]"
            />
            <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
              Published
            </span>
          </label>
        </div>
        <div className="mt-8 flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] border-t-[color:var(--color-surface-200)] pt-5">
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
