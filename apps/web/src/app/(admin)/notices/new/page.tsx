'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  pinned: z.boolean().optional(),
  targetType: z.enum(['all', 'floor', 'individual']).optional(),
  targetIds: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TARGET_OPTIONS = [
  { value: 'all', label: 'All Tenants' },
  { value: 'floor', label: 'By Floor' },
  { value: 'individual', label: 'Specific Tenant' },
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
    <FormPage
      title="Post Notice"
      description="Create a new announcement for tenants"
      backHref="/notices"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/notices"
            submitLabel="Post Notice"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <Input
            label="Title"
            placeholder="Notice title"
            error={errors.title?.message}
            {...register('title')}
          />
          <Textarea
            label="Content"
            rows={6}
            placeholder="Write the full notice content..."
            error={errors.content?.message}
            {...register('content')}
          />
          <FormGrid>
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
          </FormGrid>
          <Checkbox label="Pin this notice" {...register('pinned')} />
        </div>
      </FormCard>
    </FormPage>
  );
}
