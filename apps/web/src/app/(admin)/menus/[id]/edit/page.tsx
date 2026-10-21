'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Cookie, Info, Moon, Plus, Sun, Sunset, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { Input } from '@/components/ui/Input';
import { surfaceNestedClass } from '@/lib/field-styles';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /menus/:id    apps/api/src/routes/menus.ts:169-177
//   PUT /menus/:id    apps/api/src/routes/menus.ts:180-244

interface MenuMealItem {
  name: string;
  description?: string;
  category?: string;
}

interface MenuDayRecord {
  _id: string;
  date: string;
  meals: {
    breakfast?: MenuMealItem[];
    lunch?: MenuMealItem[];
    snacks?: MenuMealItem[];
    dinner?: MenuMealItem[];
  };
  /** Derived by the server: the date is today or later (menus.ts:33-41). */
  isActive: boolean;
}

// ── Schema ─────────────────────────────────────────────────────────────

/**
 * One dish of one slot.
 *
 * A row without a name is a row the office has not filled in yet, so the name
 * may be empty here. The payload drops those rows before the write, and the
 * server only ever receives dishes that carry a name
 * (apps/api/src/routes/menus.ts:17-31).
 */
const mealItemSchema = z.object({
  name: z.string().max(100, 'A dish name is at most 100 characters').trim(),
  description: z.string().max(300, 'A description is at most 300 characters').trim().optional(),
  category: z.string().max(50, 'A category is at most 50 characters').trim().optional(),
});

const formSchema = z.object({
  date: z.string().min(1, 'The day is required'),
  breakfast: z.array(mealItemSchema),
  lunch: z.array(mealItemSchema),
  snacks: z.array(mealItemSchema),
  dinner: z.array(mealItemSchema),
});

type FormData = z.infer<typeof formSchema>;

// ── Meal section config ────────────────────────────────────────────────

const MEAL_SECTIONS = [
  { key: 'breakfast', label: 'Breakfast', description: 'Morning meal items', icon: Sun },
  { key: 'lunch', label: 'Lunch', description: 'Midday meal items', icon: Sunset },
  { key: 'snacks', label: 'Snacks', description: 'Evening snack items', icon: Cookie },
  { key: 'dinner', label: 'Dinner', description: 'Evening meal items', icon: Moon },
] as const;

type SlotKey = (typeof MEAL_SECTIONS)[number]['key'];

// ── Helpers ────────────────────────────────────────────────────────────

/** The message of one field, whatever shape the error carries. */
function fieldMessage(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return undefined;
}

/** The dishes of a slot, without the rows the office left empty. */
function namedItems(items: FormData[SlotKey]): Array<{
  name: string;
  description?: string;
  category?: string;
}> {
  return items
    .filter((item) => item.name.trim() !== '')
    .map((item) => ({
      name: item.name.trim(),
      ...(item.description?.trim() ? { description: item.description.trim() } : {}),
      ...(item.category?.trim() ? { category: item.category.trim() } : {}),
    }));
}

// ── Component ───────────────────────────────────────────────────────────

function MenuEditForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const id = params.id as string;
  const [submitError, setSubmitError] = useState('');

  /**
   * The day, read with the shared query stack.
   *
   * The record is read once and the form is filled from it. A re-read of the
   * same record must not wipe what the office has typed, so the fill happens
   * once per record.
   */
  const {
    data: menu,
    isPending: isLoading,
    error: loadError,
  } = useApiQuery<MenuDayRecord>(['menus', 'detail', id], `menus/${id}`, { enabled: Boolean(id) });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: '',
      breakfast: [{ name: '', description: '', category: '' }],
      lunch: [{ name: '', description: '', category: '' }],
      snacks: [{ name: '', description: '', category: '' }],
      dinner: [{ name: '', description: '', category: '' }],
    },
  });
  const watchedDate = useWatch({ control, name: 'date' }) ?? '';
  const hydratedId = useRef('');
  useEffect(() => {
    if (!menu) return;
    if (hydratedId.current === menu._id) return;
    hydratedId.current = menu._id;

    const rows = (items?: MenuMealItem[]) =>
      items && items.length > 0 ? items : [{ name: '', description: '', category: '' }];

    reset({
      date: menu.date ?? '',
      breakfast: rows(menu.meals?.breakfast),
      lunch: rows(menu.meals?.lunch),
      snacks: rows(menu.meals?.snacks),
      dinner: rows(menu.meals?.dinner),
    });
  }, [menu, reset]);

  const breakfastArray = useFieldArray({ control, name: 'breakfast' });
  const lunchArray = useFieldArray({ control, name: 'lunch' });
  const snacksArray = useFieldArray({ control, name: 'snacks' });
  const dinnerArray = useFieldArray({ control, name: 'dinner' });

  const fieldArrays = {
    breakfast: breakfastArray,
    lunch: lunchArray,
    snacks: snacksArray,
    dinner: dinnerArray,
  };

  const breakfastItems = useWatch({ control, name: 'breakfast' });
  const lunchItems = useWatch({ control, name: 'lunch' });
  const snacksItems = useWatch({ control, name: 'snacks' });
  const dinnerItems = useWatch({ control, name: 'dinner' });

  const itemCounts = useMemo(
    () => ({
      breakfast: breakfastItems?.filter((item) => item.name?.trim()).length ?? 0,
      lunch: lunchItems?.filter((item) => item.name?.trim()).length ?? 0,
      snacks: snacksItems?.filter((item) => item.name?.trim()).length ?? 0,
      dinner: dinnerItems?.filter((item) => item.name?.trim()).length ?? 0,
    }),
    [breakfastItems, lunchItems, snacksItems, dinnerItems],
  );

  const totalItems =
    itemCounts.breakfast + itemCounts.lunch + itemCounts.snacks + itemCounts.dinner;

  const dateError = fieldMessage(errors.date);
  const itemErrors = errors as unknown as Record<
    string,
    Array<{ name?: { message?: string } }> | undefined
  >;

  /** The server refuses to edit a day that is already past. */
  const isPast = menu ? menu.isActive === false : false;

  const onSubmit = async (data: FormData) => {
    if (!menu) return;
    setSubmitError('');

    const allItems = [...data.breakfast, ...data.lunch, ...data.snacks, ...data.dinner];
    if (allItems.every((item) => item.name.trim() === '')) {
      setSubmitError('At least one dish with a name is required: a day with no dish is no menu.');
      return;
    }

    try {
      const payload = {
        date: data.date,
        meals: {
          breakfast: namedItems(data.breakfast),
          lunch: namedItems(data.lunch),
          snacks: namedItems(data.snacks),
          dinner: namedItems(data.dinner),
        },
      };

      // The write goes to the record the server holds, not to the address bar:
      // the address may carry a date, the record is what is changed.
      await api.put(`menus/${menu._id}`, { json: payload }).json();

      queryClient.invalidateQueries({ queryKey: ['menus'] });
      router.push(`/menus/${menu._id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const loadErrorMessage = errorMessage(loadError);

  return (
    <FormPage
      title="Change the day"
      description={
        menu
          ? `What the kitchen serves on ${menu.date}. The residents read the day from the portal.`
          : 'What the kitchen serves on one day'
      }
      backHref={menu ? `/menus/${menu._id}` : '/menus'}
      error={submitError || loadErrorMessage}
      isLoading={isLoading}
      maxWidth="form"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref={menu ? `/menus/${menu._id}` : '/menus'}
            submitLabel="Save the day"
            disabled={isPast}
            divided={false}
          />
        }
      >
        {isPast && (
          <div className="rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) px-4 py-3 text-xs font-semibold text-(--color-warning-800)">
            This day is past. The server refuses to change a menu whose date has gone (PAST_DATE),
            so the save is off. Read the day instead.
          </div>
        )}

        {/* What the save commits, before the office types anything. */}
        <FormSection title="What this save commits" icon={<Info />}>
          <ul className="text-13 space-y-1.5 leading-relaxed text-(--color-text-secondary)">
            <li>
              <strong className="text-(--color-text-primary)">The four slots of this day.</strong>{' '}
              The server rewrites the dishes of breakfast, lunch, snacks and dinner and writes an
              update entry in the audit log with the date. A slot the office empties is saved empty.
            </li>
            <li>
              <strong className="text-(--color-text-primary)">The date moves the day.</strong>{' '}
              Changing the date moves this menu to that day. The server refuses a date that is
              already past (PAST_DATE), and refuses the move when another menu already holds that
              date (DUPLICATE_MENU).
            </li>
            <li>
              <strong className="text-(--color-text-primary)">The residents pull it.</strong> The
              portal reads GET /menus/today when a resident opens the app, so the correction reaches
              them on their next load. Nobody is sent a message about the change.
            </li>
            <li>
              <strong className="text-(--color-text-primary)">An empty row is not saved.</strong> A
              row without a dish name is dropped before the write, and the day needs at least one
              dish.
            </li>
          </ul>
        </FormSection>

        <FormSection title="The day" description="The day this menu applies to" divided>
          <FormGrid cols={1}>
            <DatePicker
              label="Date"
              error={dateError}
              required
              name="date"
              value={watchedDate}
              onChange={(value) => setValue('date', value, { shouldValidate: true })}
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
                  <Plus className="h-4 w-4" /> Add dish
                </Button>
              }
            >
              <div className="space-y-3">
                {fieldArray.fields.length === 0 && (
                  <p className="rounded-(--radius-md) border border-dashed border-(--border-color) px-4 py-6 text-center text-sm text-(--color-text-secondary)">
                    No dish in this slot. A slot with no dish is saved empty, and the residents see
                    the slot as not set.
                  </p>
                )}

                {fieldArray.fields.map((field, itemIdx) => (
                  <div
                    key={field.id}
                    className={clsx(
                      surfaceNestedClass,
                      'grid grid-cols-1 gap-3 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start',
                    )}
                  >
                    <Input
                      aria-label={`${label} dish ${itemIdx + 1} name`}
                      placeholder="Dish name"
                      error={itemErrors[key]?.[itemIdx]?.name?.message}
                      {...register(`${key}.${itemIdx}.name` as const)}
                    />
                    <Input
                      aria-label={`${label} dish ${itemIdx + 1} description`}
                      placeholder="Description (optional)"
                      {...register(`${key}.${itemIdx}.description` as const)}
                    />
                    <Input
                      aria-label={`${label} dish ${itemIdx + 1} category`}
                      placeholder="Category (optional)"
                      {...register(`${key}.${itemIdx}.category` as const)}
                    />
                    <div className="flex justify-end sm:pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Remove ${label} dish ${itemIdx + 1}`}
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

        {/* What the day holds now. */}
        <FormSection title="What the day holds" divided>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border-color) bg-(--color-field-bg) px-3 py-1.5 font-semibold text-(--color-text-secondary)">
              <Sun className="h-3.5 w-3.5 text-(--color-warning-500)" />
              {itemCounts.breakfast} breakfast dishes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border-color) bg-(--color-field-bg) px-3 py-1.5 font-semibold text-(--color-text-secondary)">
              <Sunset className="h-3.5 w-3.5 text-(--color-brand-500)" />
              {itemCounts.lunch} lunch dishes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border-color) bg-(--color-field-bg) px-3 py-1.5 font-semibold text-(--color-text-secondary)">
              <Cookie className="h-3.5 w-3.5 text-(--color-warning-600)" />
              {itemCounts.snacks} snack dishes
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-(--border-color) bg-(--color-field-bg) px-3 py-1.5 font-semibold text-(--color-text-secondary)">
              <Moon className="h-3.5 w-3.5 text-(--color-info-500)" />
              {itemCounts.dinner} dinner dishes
            </span>
            <span className="font-bold text-(--color-text-primary)">
              {totalItems} dishes in all
            </span>
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}

export default function EditMenuPage() {
  return (
    <Suspense
      fallback={
        <FormPage
          title="Change the day"
          description="What the kitchen serves on one day"
          backHref="/menus"
          isLoading
          maxWidth="form"
        >
          {null}
        </FormPage>
      }
    >
      <MenuEditForm />
    </Suspense>
  );
}
