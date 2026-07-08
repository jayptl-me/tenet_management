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

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  priority: z.string().min(1, 'Priority is required'),
  isPublished: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
];

export default function EditNoticePage() {
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
    api.get(`notices/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load notice'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`notices/${id}`, { json: data }).json();
      router.push('/notices');
    } catch {
      setSubmitError('Failed to update notice');
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Notice</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update notice details</p>
        </div>
      </div>
      {submitError && <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">{submitError}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <Input label="Title" error={errors.title?.message} {...register('title')} />
          <Textarea label="Content" rows={4} error={errors.content?.message} placeholder="Enter content..." {...register('content')} />
          <Select label="Priority" options={priorityOptions} error={errors.priority?.message} {...register('priority')} />
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('isPublished')} className="text-brand-500 h-5 w-5 rounded border-[length:var(--bw-default)]" />
            <span className="text-[color:var(--color-text-primary)] text-sm font-semibold">Published</span>
          </label>
        </div>
        <div className="border-t-[length:var(--bw-strong)] border-t-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}><Save className="h-4 w-4" /> Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
