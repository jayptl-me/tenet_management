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
  title: z.string().min(1, 'Required'),
  description: z.string().min(1, 'Required'),
  category: z.string().min(1, 'Required'),
  priority: z.string().min(1, 'Required'),
  status: z.string().min(1, 'Required'),
  adminNotes: z.string().optional(),
});


const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];
const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

type FormData = z.infer<typeof schema>;

export default function EditPage() {
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
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`complaints/${id}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load data'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`complaints/${id}`, { json: data }).json();
      router.push('/complaints');
    } catch {
      setSubmitError('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Complaints</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update details</p>
        </div>
      </div>

      {submitError && (
        <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <Input
            label="Title"
            type="string"
            error={errors.title?.message}
            {...register('title')}
          />
          <Textarea
            label="Description"
            rows={3}
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            label="Category"
            type="string"
            error={errors.category?.message}
            {...register('category')}
          />
          <Select
            label="Priority"
            options={priorityOptions}
            error={errors.priority?.message}
            {...register('priority')}
          />
          <Select
            label="Status"
            options={statusOptions}
            error={errors.status?.message}
            {...register('status')}
          />
          <Input
            label="Admin Notes"
            type="string"
            error={errors.adminNotes?.message}
            {...register('adminNotes')}
          />
        </div>

        <div className="border-[color:var(--color-surface-200)] mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
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
