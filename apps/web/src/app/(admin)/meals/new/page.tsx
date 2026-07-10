'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  date: z.string().min(1, 'Date is required'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  rating: z.coerce.number().min(1, 'Min 1').max(5, 'Max 5'),
  comment: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const RATING_OPTIONS = [
  { value: '1', label: '1 Star' },
  { value: '2', label: '2 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '5', label: '5 Stars' },
];

interface TenantOption {
  _id: string;
  user?: { name: string; phone: string };
  room?: { roomNumber: string };
  bedId?: string;
}

export default function NewMealFeedbackPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 3, comment: '' },
  });

  const err = errors as Record<string, { message?: string }>;

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('meals', { json: data }).json<{ success: boolean }>();
      router.push('/meals');
    } catch {
      setSubmitError('Failed to submit feedback. Please try again.');
    }
  };

  return (
    <FormPage
      title="New Meal Feedback"
      description="Record tenant meal feedback"
      backHref="/meals"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/meals"
            submitLabel="Save Feedback"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Tenant"
                endpoint="tenants?isActive=true"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select tenant..."
                error={err.tenantId?.message}
                valueKey="_id"
                labelKey={(item) => (item as unknown as TenantOption).user?.name ?? 'Unknown'}
                sublabelFn={(item) =>
                  `Room ${(item as unknown as TenantOption).room?.roomNumber ?? 'N/A'}`
                }
                dataPath="data"
              />
            )}
          />
          <FormGrid cols={3}>
            <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
            <Select
              label="Meal Type"
              options={MEAL_OPTIONS}
              error={errors.mealType?.message}
              {...register('mealType')}
            />
            <Select
              label="Rating"
              options={RATING_OPTIONS}
              error={errors.rating?.message}
              {...register('rating')}
            />
          </FormGrid>
          <Textarea
            label="Comment"
            rows={3}
            placeholder="Optional feedback..."
            {...register('comment')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}
