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
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  type: z.string().min(1, 'Type is required'),
  targetType: z.string().min(1, 'Target type is required'),
});

type FormData = z.infer<typeof schema>;

const typeOptions = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'payment_verified', label: 'Payment Verified' },
  { value: 'complaint_update', label: 'Complaint Update' },
  { value: 'service_update', label: 'Service Update' },
  { value: 'electricity_bill', label: 'Electricity Bill' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'meal_feedback', label: 'Meal Feedback' },
];

const targetTypeOptions = [
  { value: 'all', label: 'All Tenants' },
  { value: 'floor', label: 'By Floor' },
  { value: 'room', label: 'By Room' },
  { value: 'individual', label: 'Specific Tenant' },
];

export default function EditNotificationPage() {
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
    api.get(`notifications/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load notification'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`notifications/${id}`, { json: data }).json();
      router.push('/notifications');
    } catch {
      setSubmitError('Failed to update notification');
    }
  };

  return (
    <FormPage
      title="Edit notification"
      description="Update message content and audience"
      backHref="/notifications"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/notifications"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Message" description="What tenants will see">
          <FormGrid>
            <FormFullWidth>
              <Input label="Title" error={errors.title?.message} {...register('title')} />
            </FormFullWidth>
            <FormFullWidth>
              <Textarea
                label="Body"
                rows={4}
                placeholder="Enter body..."
                error={errors.body?.message}
                {...register('body')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>

        <FormSection title="Delivery" description="Type and audience targeting" divided>
          <FormGrid>
            <Select label="Type" options={typeOptions} error={errors.type?.message} {...register('type')} />
            <Select
              label="Target"
              options={targetTypeOptions}
              error={errors.targetType?.message}
              {...register('targetType')}
            />
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
