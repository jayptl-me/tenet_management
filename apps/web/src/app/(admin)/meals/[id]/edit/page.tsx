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
  mealType: z.string().min(1, 'Meal type is required'),
  rating: z.coerce.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
});

type FormData = z.infer<typeof schema>;

const mealTypeOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const statusOptions = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'actioned', label: 'Actioned' },
];

export default function EditMealPage() {
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
    api.get(`meals/${id}`).json<{ success: boolean; data: FormData }>()
      .then((res) => { reset(res.data); setIsLoading(false); })
      .catch(() => { setSubmitError('Failed to load meal feedback'); setIsLoading(false); });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`meals/${id}`, { json: data }).json();
      router.push('/meals');
    } catch {
      setSubmitError('Failed to update meal feedback');
    }
  };

  return (
    <FormPage
      title="Edit meal feedback"
      description="Update rating, comment, and handling status"
      backHref="/meals"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/meals"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Feedback" description="Tenant meal rating and staff follow-up">
          <FormGrid>
            <Select
              label="Meal type"
              options={mealTypeOptions}
              error={errors.mealType?.message}
              {...register('mealType')}
            />
            <Input
              label="Rating (1–5)"
              type="number"
              min={1}
              max={5}
              inputMode="numeric"
              error={errors.rating?.message}
              {...register('rating')}
            />
            <Select
              label="Status"
              options={statusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
            <FormFullWidth>
              <Textarea
                label="Comment"
                rows={3}
                error={errors.comment?.message}
                {...register('comment')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
