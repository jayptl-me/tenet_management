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
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
  status: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EditLeavePage() {
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
    api.get(`leaves/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load leave application'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`leaves/${id}`, { json: data }).json();
      router.push('/leaves');
    } catch {
      setSubmitError('Failed to update leave application');
    }
  };

  return (
    <FormPage
      title="Edit leave application"
      description="Update leave dates, reason, and approval status"
      backHref="/leaves"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/leaves"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Leave period" description="Dates covered by this application">
          <FormGrid>
            <Input
              label="Start date"
              type="date"
              error={errors.startDate?.message}
              {...register('startDate')}
            />
            <Input
              label="End date"
              type="date"
              error={errors.endDate?.message}
              {...register('endDate')}
            />
            <Select
              label="Status"
              options={statusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
            <FormFullWidth>
              <Textarea
                label="Reason"
                rows={3}
                error={errors.reason?.message}
                placeholder="Enter reason..."
                {...register('reason')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
