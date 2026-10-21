'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, TriangleAlert, Utensils, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { StarRating } from '@/components/ui/StarRating';
import { CategoryChipSelect } from '@/components/ui/CategoryChipSelect';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

// ── Shapes ─────────────────────────────────────────────────────────────
//   GET /meals/:id   apps/api/src/routes/meals.ts:404-428
//   PUT /meals/:id   apps/api/src/routes/meals.ts:431-513

interface MealFeedbackDetail {
  _id: string;
  date: string;
  mealType: string;
  rating: number;
  status: string;
  comment?: string;
  categories?: string[];
  createdAt: string;
  tenant?: {
    _id?: string;
    bedId?: string | null;
    user?: { name?: string } | null;
    room?: { roomNumber?: string } | null;
  } | null;
}

const schema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  rating: z.coerce.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().max(500, 'The comment cannot exceed 500 characters').optional(),
  status: z.enum(['submitted', 'acknowledged', 'actioned']),
  categories: z
    .array(z.enum(['taste', 'variety', 'quantity', 'cleanliness', 'service']))
    .optional(),
});

type FormData = z.infer<typeof schema>;

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'actioned', label: 'Actioned' },
];

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  actioned: 'Actioned',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDay(day: string | undefined | null): string {
  if (!day) return 'unknown';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const month = MONTHS[Number(match[2]) - 1];
  return `${Number(match[3])} ${month ?? match[2]} ${match[1]}`;
}

export default function EditMealFeedbackPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [submitError, setSubmitError] = useState('');

  /**
   * The record, read through the shared query stack.
   */
  const { data: fetched, error: queryError } = useApiQuery<MealFeedbackDetail>(
    ['meals', id],
    `meals/${id}`,
    { enabled: Boolean(id) },
  );

  // The record is only ever read, so it is derived from the query instead of
  // being copied into state by an effect.
  const feedback = fetched && !Array.isArray(fetched) ? fetched : null;

  // The skeleton is shown while the record is still on its way. It is derived
  // from the query, so a record that never arrives shows the error state
  // instead of a page that spins for ever.
  const isLoading = !fetched && !queryError;
  const notFound = Boolean(fetched) && !feedback;

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

  /**
   * The form is filled from the record the server returns.
   *
   * This is the form library's own seeding, not a copy of the record into
   * state: the record itself stays in the query, and the form holds what the
   * operator is changing. The form is seeded once for the record, so a
   * background refetch cannot wipe what the operator is typing.
   */
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!feedback) return;
    if (seededFor.current === feedback._id) return;
    seededFor.current = feedback._id;
    reset({
      mealType: (feedback.mealType as FormData['mealType']) ?? 'breakfast',
      rating: feedback.rating ?? 3,
      comment: feedback.comment ?? '',
      status: (feedback.status as FormData['status']) ?? 'submitted',
      categories: (feedback.categories as FormData['categories']) ?? [],
    });
  }, [feedback, reset]);

  /**
   * The save.
   *
   * The server writes the fields that changed and an update entry in the
   * audit log. It pushes a message to the resident only when the status
   * actually moved. The record is read back from the server afterwards, and
   * the operator lands on the rating as the server holds it.
   */
  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`meals/${id}`, { json: data }).json();
      await queryClient.invalidateQueries({ queryKey: ['meals'] });
      router.push(`/meals/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const residentName = feedback?.tenant?.user?.name ?? 'A resident the server no longer holds';
  const roomNumber = feedback?.tenant?.room?.roomNumber ?? 'no room';
  return (
    <FormPage
      title="Edit meal feedback"
      description="What the resident said about the food, and what the office has done about it"
      backHref={`/meals/${id}`}
      error={
        submitError ||
        errorMessage(queryError) ||
        (notFound ? 'The server reports no meal feedback for this id.' : '')
      }
      isLoading={isLoading}
      maxWidth="form"
      badge={
        feedback ? (
          <StatusBadge
            variant={statusToVariant(feedback.status)}
            label={STATUS_LABELS[feedback.status] ?? feedback.status}
          />
        ) : undefined
      }
    >
      <div className="space-y-5">
        {feedback && (
          <>
            <DetailCard title="Who left this rating" icon={<Utensils />}>
              <DetailList>
                <DetailRow label="Resident" value={residentName} />
                <DetailRow label="Room" value={roomNumber} />
                <DetailRow label="Day of the meal" value={formatDay(feedback.date)} />
                <DetailRow
                  label="State on the server"
                  value={
                    <StatusBadge
                      variant={statusToVariant(feedback.status)}
                      label={STATUS_LABELS[feedback.status] ?? feedback.status}
                      size="xs"
                    />
                  }
                />
              </DetailList>
              <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                The record belongs to the resident, the day and the meal: the server keeps one
                rating per resident, day and meal, and a second rating for the same three replaces
                the first.
              </p>
            </DetailCard>

            <FormCard
              onSubmit={handleSubmit(onSubmit)}
              footer={
                <FormActions
                  loading={isSubmitting}
                  cancelHref={`/meals/${id}`}
                  submitLabel="Save Changes"
                  divided={false}
                />
              }
            >
              <FormSection
                title="The rating"
                description="What the resident said and where it stands"
              >
                <FormGrid>
                  <Controller
                    name="mealType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Meal type"
                        options={MEAL_OPTIONS}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={err.mealType?.message}
                      />
                    )}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-13 font-semibold text-(--color-text-primary)">
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
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Status"
                        options={STATUS_OPTIONS}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={err.status?.message}
                        helperText="Moving the status tells the resident."
                      />
                    )}
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
                      placeholder="What the resident said about the meal..."
                      error={err.comment?.message}
                      {...register('comment')}
                    />
                  </FormFullWidth>
                </FormGrid>
              </FormSection>
            </FormCard>

            {/* What the save commits, and what it does not. The office has to know
                before it commits, because rewriting a resident's words and telling
                them about it are two different things. */}
            <div className="rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) p-5 shadow-(--shadow-card)">
              <h3 className="font-display text-sm font-bold tracking-tight text-(--color-text-primary)">
                What this save commits
              </h3>
              <ul className="mt-3 space-y-2.5">
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The server writes the rating, the comment, the categories, the meal and the
                    status, and it writes an update entry in the audit log with the fields you
                    changed. The save lands on the rating, re-read from the server.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    The resident is told <strong>only</strong> when the status moves. The server
                    then pushes them a meal_feedback message saying the office has read their rating
                    or has acted on it. A push that fails is logged by the server and is not
                    reported back.
                  </span>
                </li>
                <li className="text-2xs flex items-start gap-2 font-medium text-(--color-text-secondary)">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-success-600)" />
                  <span>
                    Rewriting the rating, the comment or the categories tells the resident nothing.
                    The words on this screen are then the office&apos;s words on a record the
                    resident believes is theirs.
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
                      A meal type that collides with another rating of the same resident on the same
                      day (DUPLICATE_FEEDBACK). The server keeps one rating per resident, day and
                      meal.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
                    <span>
                      A rating outside 1 to 5, and a comment longer than 500 characters. The scale
                      is the resident&apos;s scale: the server keeps the number as it was left.
                    </span>
                  </li>
                </ul>
                <p className="text-2xs mt-2 flex items-start gap-2 font-medium text-(--color-text-muted)">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The record carries no stamp of the moment it was answered, so the age of a rating
                  cannot be read from it. The write trail on the rating page holds the time of every
                  write the office made.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </FormPage>
  );
}
