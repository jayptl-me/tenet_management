'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  pinned: z.boolean().optional(),
  targetType: z.enum(['all', 'floor', 'room', 'individual']).optional(),
  targetIds: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TARGET_OPTIONS = [
  { value: 'all', label: 'All tenants' },
  { value: 'floor', label: 'By floor' },
  { value: 'room', label: 'By room' },
  { value: 'individual', label: 'Specific tenant' },
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
    defaultValues: { content: '', pinned: false, targetIds: '', targetType: 'all' },
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
          targetType:
            (d.targetType as 'all' | 'floor' | 'room' | 'individual') ?? 'all',
          targetIds: Array.isArray(d.targetIds) ? (d.targetIds as string[]).join(', ') : '',
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
      title: data.title,
      content: data.content,
      pinned: data.pinned ?? false,
      targetType: data.targetType ?? 'all',
      targetIds: data.targetIds
        ? data.targetIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    };
    try {
      await api.put(`notices/${id}`, { json: payload }).json();
      router.push('/notices');
    } catch {
      setSubmitError('Failed to update notice');
    }
  };

  return (
    <FormPage
      title="Edit Notice"
      description="Update bulletin content, audience, and publish state"
      backHref="/notices"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/notices"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Content" description="Headline and body shown to tenants">
          <FormGrid>
            <FormFullWidth>
              <Input label="Title" error={errors.title?.message} {...register('title')} />
            </FormFullWidth>
            <FormFullWidth>
              <Textarea
                label="Content"
                rows={6}
                placeholder="Write the full notice content..."
                error={errors.content?.message}
                {...register('content')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>

        <FormSection title="Audience" description="Who should see this notice" divided>
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
        </FormSection>

        <FormSection
          title="Publishing"
          description="Pin state on the notices board"
          divided
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            <Checkbox label="Pin this notice" {...register('pinned')} />
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
