'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

// ── Schema ──────────────────────────────────────────────

const mealItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100),
  description: z.string().max(300).optional(),
  category: z.string().max(50).optional(),
});

const mealCollectionSchema = z.object({
  breakfast: z.array(mealItemSchema),
  lunch: z.array(mealItemSchema),
  dinner: z.array(mealItemSchema),
});

const formSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  meals: mealCollectionSchema,
});

type FormData = z.infer<typeof formSchema>;

// ── Meal section config ─────────────────────────────────

const MEAL_SECTIONS = [
  { key: 'breakfast' as const, label: 'Breakfast', description: 'Morning meal items', icon: Sun },
  { key: 'lunch' as const, label: 'Lunch', description: 'Midday meal items', icon: Sunset },
  { key: 'dinner' as const, label: 'Dinner', description: 'Evening meal items', icon: Moon },
];

// ── Component ───────────────────────────────────────────

export default function EditMenuPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [itemCounts, setItemCounts] = useState({ breakfast: 0, lunch: 0, dinner: 0 });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: '',
      meals: {
        breakfast: [{ name: '', description: '', category: '' }],
        lunch: [{ name: '', description: '', category: '' }],
        dinner: [{ name: '', description: '', category: '' }],
      },
    },
  });

  const breakfastArray = useFieldArray({ control, name: 'meals.breakfast' });
  const lunchArray = useFieldArray({ control, name: 'meals.lunch' });
  const dinnerArray = useFieldArray({ control, name: 'meals.dinner' });

  const fieldArrays = {
    breakfast: breakfastArray,
    lunch: lunchArray,
    dinner: dinnerArray,
  };

  // Watch meal names for dynamic summary count
  const breakfastItems = useWatch({ control, name: 'meals.breakfast' });
  const lunchItems = useWatch({ control, name: 'meals.lunch' });
  const dinnerItems = useWatch({ control, name: 'meals.dinner' });

  // Update item counts when meals change
  useEffect(() => {
    setItemCounts({
      breakfast: breakfastItems?.filter((i: { name: string }) => i.name?.trim()).length ?? 0,
      lunch: lunchItems?.filter((i: { name: string }) => i.name?.trim()).length ?? 0,
      dinner: dinnerItems?.filter((i: { name: string }) => i.name?.trim()).length ?? 0,
    });
  }, [breakfastItems, lunchItems, dinnerItems]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`menus/${id}`)
      .json<{
        success: boolean;
        data: {
          date: string;
          meals: {
            breakfast: { name: string; description?: string }[];
            lunch: { name: string; description?: string }[];
            dinner: { name: string; description?: string }[];
          };
        };
      }>()
      .then((res) => {
        const d = res.data;
        reset({
          date: d.date ?? '',
          meals: {
            breakfast: d.meals?.breakfast?.length
              ? d.meals.breakfast
              : [{ name: '', description: '' }],
            lunch: d.meals?.lunch?.length ? d.meals.lunch : [{ name: '', description: '' }],
            dinner: d.meals?.dinner?.length ? d.meals.dinner : [{ name: '', description: '' }],
          },
        });
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load menu');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');

    // Validate all items have names
    const allItems = [...data.meals.breakfast, ...data.meals.lunch, ...data.meals.dinner];

    if (allItems.length === 0 || allItems.every((item) => !item.name.trim())) {
      setSubmitError('At least one meal item with a name is required.');
      return;
    }

    try {
      const payload = {
        date: data.date,
        meals: {
          breakfast: data.meals.breakfast
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
              ...(i.category?.trim() ? { category: i.category.trim() } : {}),
            })),
          lunch: data.meals.lunch
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
              ...(i.category?.trim() ? { category: i.category.trim() } : {}),
            })),
          dinner: data.meals.dinner
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
              ...(i.category?.trim() ? { category: i.category.trim() } : {}),
            })),
        },
      };

      await api.put(`menus/${id}`, { json: payload }).json();
      router.push('/menus');
    } catch {
      setSubmitError('Failed to update menu');
    }
  };

  const totalItems = itemCounts.breakfast + itemCounts.lunch + itemCounts.dinner;

  return (
    <FormPage
      title="Edit Daily Menu"
      description="Update menu meals and date"
      backHref="/menus"
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/menus"
            submitLabel="Save Changes"
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
                        {...register(`meals.${key}.${itemIdx}.name` as const)}
                        placeholder="Item name"
                        className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
                      />
                    </div>
                    <input
                      {...register(`meals.${key}.${itemIdx}.description` as const)}
                      placeholder="Description (optional)"
                      className="w-full rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)]"
                    />
                    <input
                      {...register(`meals.${key}.${itemIdx}.category` as const)}
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
