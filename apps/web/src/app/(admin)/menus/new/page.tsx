'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

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

  const updateMeal = (mealIndex: number, patch: Partial<MealItem>) => {
    setForm((prev) => ({
      ...prev,
      meals: prev.meals.map((m, i) => (i === mealIndex ? { ...m, ...patch } : m)),
    }));
  };

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

    // Validate at least one item per meal
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
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="font-display text-[color:var(--color-surface-900)] text-2xl font-extrabold">
            Create Daily Menu
          </h2>
          <p className="text-[color:var(--color-surface-500)] mt-0.5 text-sm">
            Plan meals for a specific date
          </p>
        </div>
      </div>

      {error && (
        <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date & Status */}
        <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <Select
              label="Day of Week"
              options={[{ value: '', label: 'Auto-detect from date' }, ...daysOfWeek]}
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
            />
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="text-[color:var(--color-brand-500)] h-5 w-5 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
                />
                <span className="font-[family:var(--font-body)] text-[color:var(--color-surface-700)] text-sm font-semibold">
                  Active
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Meals */}
        {form.meals.map((meal, mealIdx) => (
          <section
            key={meal.mealType}
            className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
          >
            <h3 className="font-display text-[color:var(--color-surface-900)] text-lg font-bold capitalize">
              {meal.mealType}
            </h3>
            <div className="space-y-2">
              {meal.items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-center gap-2">
                  <Input
                    placeholder={`${meal.mealType} item ${itemIdx + 1}...`}
                    value={item}
                    onChange={(e) => updateMealItem(mealIdx, itemIdx, e.target.value)}
                    className="flex-1"
                  />
                  {meal.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMealItem(mealIdx, itemIdx)}
                      className="text-[color:var(--color-danger-500)] hover:bg-[color:var(--color-danger-50)] rounded-md p-2 transition-colors duration-[var(--transition-duration)]"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => addMealItem(mealIdx)}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </section>
        ))}

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" loading={isSaving} size="lg">
            <Save className="h-5 w-5" />
            Create Menu
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
