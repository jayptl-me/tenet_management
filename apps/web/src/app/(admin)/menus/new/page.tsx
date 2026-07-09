'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

interface MealItem {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  items: string[];
}

interface MenuFormData {
  date: string;
  dayOfWeek: string;
  isActive: boolean;
  meals: MealItem[];
}

const emptyMeals: MealItem[] = [
  { mealType: 'breakfast', items: [''] },
  { mealType: 'lunch', items: [''] },
  { mealType: 'dinner', items: [''] },
];

const daysOfWeek = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const mealMeta: Record<
  MealItem['mealType'],
  { label: string; description: string }
> = {
  breakfast: { label: 'Breakfast', description: 'Morning meal items' },
  lunch: { label: 'Lunch', description: 'Midday meal items' },
  dinner: { label: 'Dinner', description: 'Evening meal items' },
};

export default function NewMenuPage() {
  const router = useRouter();
  const [form, setForm] = useState<MenuFormData>({
    date: new Date().toISOString().slice(0, 10),
    dayOfWeek: '',
    isActive: true,
    meals: emptyMeals,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const updateMealItem = (mealIndex: number, itemIndex: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      meals: prev.meals.map((m, i) =>
        i === mealIndex
          ? { ...m, items: m.items.map((item, j) => (j === itemIndex ? value : item)) }
          : m,
      ),
    }));
  };

  const addMealItem = (mealIndex: number) => {
    setForm((prev) => ({
      ...prev,
      meals: prev.meals.map((m, i) =>
        i === mealIndex ? { ...m, items: [...m.items, ''] } : m,
      ),
    }));
  };

  const removeMealItem = (mealIndex: number, itemIndex: number) => {
    setForm((prev) => ({
      ...prev,
      meals: prev.meals.map((m, i) =>
        i === mealIndex ? { ...m, items: m.items.filter((_, j) => j !== itemIndex) } : m,
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const hasEmpty = form.meals.some((m) => m.items.some((item) => !item.trim()));
    if (hasEmpty) {
      setError('All meal items must be filled in or removed.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        date: form.date,
        dayOfWeek: form.dayOfWeek || undefined,
        isActive: form.isActive,
        meals: form.meals
          .filter((m) => m.items.some((item) => item.trim()))
          .map((m) => ({
            mealType: m.mealType,
            items: m.items.filter((item) => item.trim()),
          })),
      };

      await api.post('menus', { json: payload }).json();
      router.push('/menus');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create menu. Please try again.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormPage
      title="Create Daily Menu"
      description="Plan meals for a specific date"
      backHref="/menus"
      error={error}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit}
        footer={
          <FormActions
            loading={isSaving}
            cancelHref="/menus"
            submitLabel="Create Menu"
            divided={false}
          />
        }
      >
        <FormSection
          title="Date and status"
          description="When this menu applies and whether it is active"
        >
          <FormGrid cols={3}>
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <Select
              label="Day of week"
              options={[{ value: '', label: 'Auto-detect from date' }, ...daysOfWeek]}
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
            />
            <div className="flex items-end pb-2">
              <Checkbox
                label="Active"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
            </div>
          </FormGrid>
        </FormSection>

        {form.meals.map((meal, mealIdx) => {
          const meta = mealMeta[meal.mealType];
          return (
            <FormSection
              key={meal.mealType}
              title={meta.label}
              description={meta.description}
              divided
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addMealItem(mealIdx)}
                >
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              }
            >
              <div className="space-y-3">
                {meal.items.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className={clsx(
                      surfaceNestedClass,
                      'flex flex-col gap-2 p-3 sm:flex-row sm:items-center',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <Input
                        label={itemIdx === 0 ? 'Item' : undefined}
                        placeholder={`${meta.label} item ${itemIdx + 1}...`}
                        value={item}
                        onChange={(e) => updateMealItem(mealIdx, itemIdx, e.target.value)}
                      />
                    </div>
                    {meal.items.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Remove ${meta.label} item ${itemIdx + 1}`}
                        onClick={() => removeMealItem(mealIdx, itemIdx)}
                        className="shrink-0 self-end sm:self-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </FormSection>
          );
        })}
      </FormCard>
    </FormPage>
  );
}
