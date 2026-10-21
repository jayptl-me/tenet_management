'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, TriangleAlert, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { tenantLabel, tenantSublabel } from '@/lib/resource-select-presets';
import { parseApiError } from '@/lib/errorParser';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';
import { CategoryChipSelect } from '@/components/ui/CategoryChipSelect';
import { StarRating } from '@/components/ui/StarRating';

// ── The route this form writes:
//   POST /meals   apps/api/src/routes/meals.ts:141-188
//   The schema it accepts: apps/api/src/routes/meals.ts:129-138

const schema = z.object({
  tenantId: z.string().min(1, 'A resident is required'),
  date: z.string().min(1, 'A day is required'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  rating: z.coerce.number().min(1, 'Min 1').max(5, 'Max 5'),
  categories: z.array(z.string()).optional(),
  comment: z.string().max(500, 'The comment cannot exceed 500 characters').optional(),
});

type FormData = z.infer<typeof schema>;

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

export default function NewMealFeedbackPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 3, comment: '', categories: ['taste'] },
  });
  const watchedDate = useWatch({ control, name: 'date' }) ?? '';
  const err = errors as Record<string, { message?: string }>;

  /**
   * The save.
   *
   * The server upserts the rating for that resident, day and meal, resets the
   * status to submitted and writes a create entry in the audit log. It sends
   * no message to the resident.
   */
  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('meals', { json: data }).json<{ success: boolean }>();
      router.push('/meals');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title="Record a meal rating"
      description="What a resident said about a meal, recorded on their behalf"
      backHref="/meals"
      error={submitError}
      maxWidth="form"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/meals"
            submitLabel="Save the rating"
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
                label="Resident"
                endpoint="tenants?isActive=true"
                value={field.value}
                onChange={field.onChange}
                placeholder="Select the resident..."
                error={err.tenantId?.message}
                valueKey="_id"
                labelKey={tenantLabel}
                sublabelFn={(item) => tenantSublabel(item as { monthlyRent?: number })}
                dataPath="data"
              />
            )}
          />
          <FormGrid cols={3}>
            <DatePicker
              label="Date"
              error={err.date?.message}
              name="date"
              value={watchedDate}
              onChange={(value) => setValue('date', value, { shouldValidate: true })}
            />
            <Controller
              name="mealType"
              control={control}
              render={({ field }) => (
                <Select
                  label="Meal"
                  options={MEAL_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.mealType?.message}
                />
              )}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-13 font-semibold text-(--color-text-primary)">Rating</label>
              <Controller
                name="rating"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <StarRating value={field.value ?? 0} onChange={field.onChange} size="lg" />
                    <span className="font-display text-sm font-bold text-(--color-warning-500)">
                      {field.value ?? 0}/5
                    </span>
                  </div>
                )}
              />
              {errors.rating?.message && (
                <p className="text-12 font-medium text-(--color-danger-600)">
                  {errors.rating.message}
                </p>
              )}
            </div>
          </FormGrid>
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
          <Textarea
            label="Comment"
            rows={3}
            placeholder="What the resident said about the meal..."
            error={err.comment?.message}
            {...register('comment')}
          />
        </div>
      </FormCard>

      {/* What the save commits, and what it does not. The office has to know
          before it commits, because a rating written for a resident is a
          record in their name. */}
      <div className="mt-4 rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
        <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
          What this save commits
        </h3>
        <ul className="mt-3 space-y-2.5">
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The server writes one rating for this resident, this day and this meal, and it writes
              a create entry in the audit log with the resident, the day, the meal and the rating.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The rating lands in the triage queue as submitted: the office has not read it yet. A
              rating the resident left earlier for the same day and meal is replaced by this one,
              and the status of the older rating goes back to submitted with it.
            </span>
          </li>
          <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
            <span>
              The rating is the number the resident gave, from 1 to 5. The office does not compute
              an average here: the server averages the ratings of a meal service on the list page.
            </span>
          </li>
        </ul>

        <div className="mt-4 border-t border-(--border-color) pt-3">
          <p className="tracking-label text-2xs font-bold text-(--color-text-muted) uppercase">
            What this save refuses
          </p>
          <ul className="text-2xs mt-2 space-y-1.5 font-medium text-(--color-text-secondary)">
            <li className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
              <span>
                A day that has not happened yet (FUTURE_DATE_INVALID) and a resident the server does
                not know.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
              <span>
                A rating outside 1 to 5, and a comment longer than 500 characters. The categories
                are the ones the server knows: taste, variety, quantity, cleanliness and service.
              </span>
            </li>
          </ul>
          <p className="text-2xs mt-2 flex items-start gap-2 font-medium text-(--color-text-muted)">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The resident is not told about this write. A rating recorded on their behalf appears in
            their portal as theirs, and the only message the server sends them is the one that
            follows a status moving.
          </p>
        </div>
      </div>
    </FormPage>
  );
}
