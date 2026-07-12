'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Utensils, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { StarRating } from '@/components/ui/StarRating';
import { CategoryChipSelect } from '@/components/ui/CategoryChipSelect';

const schema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  rating: z.coerce.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().optional(),
  status: z.enum(['submitted', 'acknowledged', 'actioned']),
  categories: z
    .array(z.enum(['taste', 'variety', 'quantity', 'cleanliness', 'service']))
    .optional(),
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

interface MealFeedbackDetail {
  _id: string;
  mealType: string;
  rating: number;
  comment?: string;
  status: string;
  date?: string;
  categories?: string[];
  tenantId?: {
    _id?: string;
    userId?: { name?: string };
    roomId?: { roomNumber?: string };
  };
  menuId?: {
    _id?: string;
    date?: string;
    meals?: Record<string, unknown>;
  };
  createdAt: string;
}

export default function EditMealFeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [feedbackData, setFeedbackData] = useState<MealFeedbackDetail | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 3, comment: '', categories: [] },
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`meals/${id}`)
      .json<{ success: boolean; data: MealFeedbackDetail }>()
      .then((res) => {
        setFeedbackData(res.data);
        reset({
          mealType: (res.data.mealType as FormData['mealType']) ?? 'breakfast',
          rating: res.data.rating ?? 3,
          comment: res.data.comment ?? '',
          status: (res.data.status as FormData['status']) ?? 'submitted',
          categories: (res.data.categories as FormData['categories']) ?? [],
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load meal feedback');
        setIsLoading(false);
      });
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

  const tenant = feedbackData?.tenantId;
  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Meal Feedback"
      description="Update rating, comment, and handling status"
      backHref="/meals"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {tenant && (
          <DetailCard title="Submitted by" icon={<Utensils />}>
            <DetailList>
              <DetailRow label="Name" value={tenant.userId?.name ?? 'N/A'} />
              <DetailRow label="Room" value={tenant.roomId?.roomNumber ?? 'N/A'} />
              <DetailRow
                label="Date"
                value={
                  feedbackData?.date
                    ? new Date(feedbackData.date).toLocaleDateString('en-IN')
                    : new Date(feedbackData?.createdAt ?? '').toLocaleDateString('en-IN')
                }
              />
            </DetailList>
          </DetailCard>
        )}

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
          <FormSection title="Feedback" description="Meal rating and staff follow-up">
            <FormGrid>
              <Select
                label="Meal type"
                options={mealTypeOptions}
                error={err.mealType?.message}
                {...register('mealType')}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                  Rating
                </label>
                <Controller
                  name="rating"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <StarRating
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        size="lg"
                      />
                      <span className="font-display text-sm font-bold text-[color:var(--color-warning-500)]">
                        {field.value ?? 0}/5
                      </span>
                    </div>
                  )}
                />
                {errors.rating?.message && (
                  <p className="text-[12px] font-medium text-[color:var(--color-danger-600)]">
                    {errors.rating.message}
                  </p>
                )}
              </div>
              <Select
                label="Status"
                options={statusOptions}
                error={err.status?.message}
                leftIcon={<MessageSquare className="h-4 w-4" />}
                {...register('status')}
              />
              <FormFullWidth>
                <Controller
                  name="categories"
                  control={control}
                  render={({ field }) => (
                    <CategoryChipSelect
                      label="Categories"
                      value={field.value ?? []}
                      onChange={field.onChange}
                      error={err.categories?.message}
                    />
                  )}
                />
              </FormFullWidth>
              <FormFullWidth>
                <Textarea
                  label="Comment"
                  rows={3}
                  placeholder="Tenant feedback comment..."
                  error={err.comment?.message}
                  {...register('comment')}
                />
              </FormFullWidth>
            </FormGrid>
          </FormSection>
        </FormCard>
      </div>
    </FormPage>
  );
}
