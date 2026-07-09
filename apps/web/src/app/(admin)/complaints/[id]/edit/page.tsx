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
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

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
      .then((res) => {
        reset(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load data');
        setIsLoading(false);
      });
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

  return (
    <FormPage
      title="Edit Complaint"
      description="Update complaint details and resolution status"
      backHref="/complaints"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/complaints"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection
          title="Complaint details"
          description="What was reported and which category it falls under"
        >
          <FormGrid>
            <Input label="Title" error={errors.title?.message} {...register('title')} />
            <Input label="Category" error={errors.category?.message} {...register('category')} />
            <FormFullWidth>
              <Textarea
                label="Description"
                rows={3}
                error={errors.description?.message}
                {...register('description')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Priority and status"
          description="Triage and track resolution progress"
          divided
        >
          <FormGrid>
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
          </FormGrid>
        </FormSection>

        <FormSection
          title="Admin notes"
          description="Internal notes visible to staff only"
          divided
        >
          <Textarea
            label="Admin notes"
            rows={3}
            placeholder="Optional internal notes..."
            error={errors.adminNotes?.message}
            {...register('adminNotes')}
          />
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
