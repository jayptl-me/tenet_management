'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

const schema = z.object({
  date: z.string().min(1, 'Required'),
  status: z.enum(['present', 'absent', 'on_leave', 'not_returned']),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  notes: z.string().optional(),
});

const statusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'not_returned', label: 'Not Returned' },
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
      .get(`attendance/${id}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load data'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`attendance/${id}`, { json: data }).json();
      router.push('/attendance');
    } catch {
      setSubmitError('Failed to update');
    }
  };

  return (
    <FormPage
      title="Edit attendance"
      description="Update attendance status and check-in times"
      backHref="/attendance"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/attendance"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Attendance" description="Date and presence status">
          <FormGrid>
            <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
            <Select
              label="Status"
              options={statusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
            <Input
              label="Check-in time"
              type="time"
              error={errors.checkInTime?.message}
              {...register('checkInTime')}
            />
            <Input
              label="Check-out time"
              type="time"
              error={errors.checkOutTime?.message}
              {...register('checkOutTime')}
            />
            <FormFullWidth>
              <Input label="Notes" error={errors.notes?.message} {...register('notes')} />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
