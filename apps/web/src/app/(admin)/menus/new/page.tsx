'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Sun, Moon, Sunset } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { surfaceNestedClass, fieldLabelClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidYmd(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// ── Schema ──────────────────────────────────────────────

const mealItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100),
  description: z.string().max(300).optional(),
  category: z.string().max(50).optional(),
});

const formSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  breakfast: z.array(mealItemSchema),
  lunch: z.array(mealItemSchema),
  dinner: z.array(mealItemSchema),
});

type FormData = z.infer<typeof formSchema>;

// ── Meal section config ─────────────────────────────────

const MEAL_SECTIONS = [
  { key: 'breakfast' as const, label: 'Breakfast', description: 'Morning meal items', icon: Sun },
  { key: 'lunch' as const, label: 'Lunch', description: 'Midday meal items', icon: Sunset },
  { key: 'dinner' as const, label: 'Dinner', description: 'Evening meal items', icon: Moon },
];

// ── Component ───────────────────────────────────────────

export default function NewMenuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState('');
  const dateParam = searchParams.get('date');
  const defaultDate = isValidYmd(dateParam) ? dateParam : localTodayYmd();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: defaultDate,
      breakfast: [{ name: '', description: '', category: '' }],
      lunch: [{ name: '', description: '', category: '' }],
      dinner: [{ name: '', description: '', category: '' }],
    },
  });

  const breakfastArray = useFieldArray({ control, name: 'breakfast' });
  const lunchArray = useFieldArray({ control, name: 'lunch' });
  const dinnerArray = useFieldArray({ control, name: 'dinner' });

  const fieldArrays = {
    breakfast: breakfastArray,
    lunch: lunchArray,
    dinner: dinnerArray,
  };

  const breakfastItems = useWatch({ control, name: 'breakfast' });
  const lunchItems = useWatch({ control, name: 'lunch' });
  const dinnerItems = useWatch({ control, name: 'dinner' });

  const itemCounts = {
    breakfast: breakfastItems?.filter((i) => i.name?.trim()).length ?? 0,
    lunch: lunchItems?.filter((i) => i.name?.trim()).length ?? 0,
    dinner: dinnerItems?.filter((i) => i.name?.trim()).length ?? 0,
  };

  const totalItems = itemCounts.breakfast + itemCounts.lunch + itemCounts.dinner;

  const onSubmit = async (data: FormData) => {
    setSubmitError('');

    const allItems = [...data.breakfast, ...data.lunch, ...data.dinner];
    if (allItems.length === 0 || allItems.every((item) => !item.name.trim())) {
      setSubmitError('At least one meal item with a name is required.');
      return;
    }

    try {
      const payload = {
        date: data.date,
        meals: {
          breakfast: data.breakfast
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
              ...(i.category?.trim() ? { category: i.category.trim() } : {}),
            })),
          lunch: data.lunch
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
              ...(i.category?.trim() ? { category: i.category.trim() } : {}),
            })),
          dinner: data.dinner
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
              ...(i.category?.trim() ? { category: i.category.trim() } : {}),
            })),
        },
      };

      await api.post('menus', { json: payload }).json<{ success: boolean }>();
      router.push('/menus');
    } catch {
      setSubmitError('Failed to create menu. Please try again.');
    }
  };

  return (
    <FormPage
      title="New Daily Menu"
      description="Create a new daily menu with breakfast, lunch, and dinner items"
      backHref="/menus"
      error={submitError}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/menus"
            submitLabel="Save Menu"
            divided={false}
          />
        }
      >
        <FormSection title="Date" description="Day this menu applies to">
          <FormGrid cols={1}>
            <Input
              label="Date"
              type="date"
              error={(errors as Record<string, { message?: string }>).date?.message}
              {...register('date')}
              required
            />
          </FormGrid>
        </FormSection>

        {MEAL_SECTIONS.map(({ key, label, description }) => {
          const fieldArray = fieldArrays[key];

          return (
            <FormSection
              key={key}
              title={label}
              description={description}
              divided
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fieldArray.append({ name: '', description: '', category: '' })}
                >
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              }
            >
              <div className="space-y-3">
                {fieldArray.fields.length === 0 && (
                  <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-color)] px-4 py-6 text-center text-sm text-[color:var(--color-text-secondary)]">
                    No items yet. Add an item to begin.
                  </p>
                )}

                {fieldArray.fields.map((field, itemIdx) => (
                  <div
                    key={field.id}
                    className={clsx(
                      surfaceNestedClass,
                      'grid grid-cols-1 gap-3 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end',
                    )}
                  >
                    <div className="flex flex-col gap-1.5">
                      <label className={fieldLabelClass} htmlFor={`${key}-${itemIdx}-name`}>
                        Item name
                      </label>
                      <input
                        id={`${key}-${itemIdx}-name`}
                        {...register(`${key}.${itemIdx}.name` as const)}
                        placeholder="Item name"
                        className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
                      />
                    </div>
                    <input
                      {...register(`${key}.${itemIdx}.description` as const)}
                      placeholder="Description (optional)"
                      className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
                    />
                    <input
                      {...register(`${key}.${itemIdx}.category` as const)}
                      placeholder="Category (optional)"
                      className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
                    />
                    <div className="flex justify-end sm:pb-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Remove ${label} item ${itemIdx + 1}`}
                        onClick={() => fieldArray.remove(itemIdx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </FormSection>
          );
        })}

        {/* Summary */}
        <FormSection title="Summary" divided>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-1.5 font-semibold text-[color:var(--color-text-secondary)]">
              <Sun className="h-3.5 w-3.5 text-[color:var(--color-warning-500)]" />
              {itemCounts.breakfast} breakfast items
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-1.5 font-semibold text-[color:var(--color-text-secondary)]">
              <Sunset className="h-3.5 w-3.5 text-[color:var(--color-brand-500)]" />
              {itemCounts.lunch} lunch items
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-1.5 font-semibold text-[color:var(--color-text-secondary)]">
              <Moon className="h-3.5 w-3.5 text-[color:var(--color-info-500)]" />
              {itemCounts.dinner} dinner items
            </span>
            <span className="text-[color:var(--color-text-muted)]">|</span>
            <span className="font-bold text-[color:var(--color-text-primary)]">
              {totalItems} total items
            </span>
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
