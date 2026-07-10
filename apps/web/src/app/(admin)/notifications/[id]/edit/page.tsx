'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, Send } from 'lucide-react';
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
  type: z.enum([
    'announcement',
    'emergency',
    'payment_reminder',
    'payment_verified',
    'complaint_update',
    'service_update',
    'electricity_bill',
    'welcome',
    'meal_feedback',
  ]),
  targetType: z.enum(['all', 'floor', 'room', 'individual']),
  targetIds: z.string().optional(),
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

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const currentType = useWatch({ control, name: 'type' });
  const currentTarget = useWatch({ control, name: 'targetType' });

  useEffect(() => {
    if (!id) return;
    api
      .get(`notifications/${id}`)
      .json<{ success: boolean; data: FormData & { _id: string; targetIds?: string | string[] } }>()
      .then((res) => {
        const d = res.data;
        reset({
          title: d.title ?? '',
          body: d.body ?? '',
          type: (d.type as FormData['type']) ?? 'announcement',
          targetType: (d.targetType as FormData['targetType']) ?? 'all',
          targetIds: Array.isArray(d.targetIds) ? d.targetIds.join(', ') : (d.targetIds ?? ''),
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load notification');
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
      await api.put(`notifications/${id}`, { json: payload }).json();
      router.push('/notifications');
    } catch {
      setSubmitError('Failed to update notification');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Notification"
      description="Update message content and audience targeting"
      backHref="/notifications"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
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
        <FormSection title="Message content" description="What tenants will see">
          <FormGrid>
            <FormFullWidth>
              <Input
                label="Title"
                placeholder="Notification headline"
                error={err.title?.message}
                leftIcon={<Bell className="h-4 w-4" />}
                {...register('title')}
              />
            </FormFullWidth>
            <FormFullWidth>
              <Textarea
                label="Body"
                rows={4}
                placeholder="Full notification message..."
                error={err.body?.message}
                {...register('body')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>

        <FormSection title="Delivery settings" description="Type and audience targeting" divided>
          <FormGrid>
            <Select
              label="Notification type"
              options={typeOptions}
              error={err.type?.message}
              {...register('type')}
            />
            <Select
              label="Target audience"
              options={targetTypeOptions}
              error={err.targetType?.message}
              {...register('targetType')}
            />
            {currentTarget !== 'all' && (
              <Input
                label="Target IDs"
                placeholder="Comma-separated IDs (room, floor, or tenant)"
                hint={
                  currentTarget === 'floor'
                    ? 'e.g. floor1, floor2'
                    : currentTarget === 'room'
                      ? 'e.g. room1, room2'
                      : 'e.g. tenant1, tenant2'
                }
                error={err.targetIds?.message}
                {...register('targetIds')}
              />
            )}
          </FormGrid>

          <div className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] px-3 py-2">
            <p className="text-xs font-medium text-[color:var(--color-brand-700)]">
              <Send className="mr-1 inline h-3 w-3" />
              This notification will be sent to{' '}
              {currentTarget === 'all' ? 'all tenants' : `selected ${currentTarget}s`}.
              {currentType === 'emergency' && ' Emergency notifications bypass quiet hours.'}
            </p>
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
