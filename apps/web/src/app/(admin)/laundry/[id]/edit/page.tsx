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
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.coerce.number().min(0, 'Must be >= 0').optional(),
  status: z.enum(['booked', 'completed', 'cancelled']),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function EditLaundrySlotPage() {
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
      .get(`laundry-slots/${id}`)
      .json<{ success: boolean; data: FormData & { _id: string } }>()
      .then((res) => {
        const d = res.data;
        reset({
          slotDate: d.slotDate ?? '',
          slotTime: d.slotTime ?? '',
          items: d.items ?? 0,
          status: (d.status as 'booked' | 'completed' | 'cancelled') ?? 'booked',
          notes: d.notes ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load laundry slot');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`laundry-slots/${id}`, { json: data }).json();
      router.push('/laundry');
    } catch {
      setSubmitError('Failed to update laundry slot');
    }
  };

  return (
    <FormPage
      title="Edit Laundry Slot"
      description="Update booking time, item count, and status"
      backHref="/laundry"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/laundry"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection
          title="Slot details"
          description="When the laundry slot is booked and how many items"
        >
          <FormGrid>
            <Input
              label="Slot date"
              type="date"
              error={errors.slotDate?.message}
              {...register('slotDate')}
            />
            <Input
              label="Slot time"
              type="time"
              error={errors.slotTime?.message}
              {...register('slotTime')}
            />
            <Input
              label="Items"
              type="number"
              error={errors.items?.message}
              {...register('items')}
            />
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              error={errors.status?.message}
              {...register('status')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Notes" description="Optional remarks for this booking" divided>
          <FormGrid cols={1}>
            <FormFullWidth>
              <Textarea
                label="Notes"
                rows={3}
                placeholder="Optional notes..."
                error={errors.notes?.message}
                {...register('notes')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
