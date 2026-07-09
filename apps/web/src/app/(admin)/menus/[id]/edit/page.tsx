'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { surfaceNestedClass } from '@/lib/field-styles';
import { clsx } from 'clsx';

interface MenuFormState {
  date: string;
  meals: {
    breakfast: { name: string; description?: string }[];
    lunch: { name: string; description?: string }[];
    dinner: { name: string; description?: string }[];
  };
}

export default function EditMenuPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<MenuFormState>({
    date: '',
    meals: { breakfast: [], lunch: [], dinner: [] },
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`menus/${id}`)
      .json<{ success: boolean; data: MenuFormState }>()
      .then((res) => {
        const d = res.data;
        setForm({
          date: d.date ?? '',
          meals: {
            breakfast: d.meals?.breakfast ?? [],
            lunch: d.meals?.lunch ?? [],
            dinner: d.meals?.dinner ?? [],
          },
        });
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load menu');
        setIsLoading(false);
      });
  }, [id]);

  const updateMealItem = (
    mealKey: 'breakfast' | 'lunch' | 'dinner',
    itemIndex: number,
    field: 'name' | 'description',
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      meals: {
        ...prev.meals,
        [mealKey]: prev.meals[mealKey].map((item, i) =>
          i === itemIndex ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const addMealItem = (mealKey: 'breakfast' | 'lunch' | 'dinner') => {
    setForm((prev) => ({
      ...prev,
      meals: {
        ...prev.meals,
        [mealKey]: [...prev.meals[mealKey], { name: '', description: '' }],
      },
    }));
  };

  const removeMealItem = (mealKey: 'breakfast' | 'lunch' | 'dinner', itemIndex: number) => {
    setForm((prev) => ({
      ...prev,
      meals: {
        ...prev.meals,
        [mealKey]: prev.meals[mealKey].filter((_, i) => i !== itemIndex),
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const hasEmpty = Object.values(form.meals).some((items) =>
      items.some((item) => !item.name.trim()),
    );
    if (hasEmpty) {
      setError('All meal items must have a name or be removed.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        date: form.date,
        meals: {
          breakfast: form.meals.breakfast
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
            })),
          lunch: form.meals.lunch
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
            })),
          dinner: form.meals.dinner
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              ...(i.description?.trim() ? { description: i.description.trim() } : {}),
            })),
        },
      };

      await api.put(`menus/${id}`, { json: payload }).json();
      router.push('/menus');
    } catch {
      setError('Failed to update menu');
    } finally {
      setIsSaving(false);
    }
  };

  const mealSections: {
    key: 'breakfast' | 'lunch' | 'dinner';
    label: string;
    description: string;
  }[] = [
    { key: 'breakfast', label: 'Breakfast', description: 'Morning meal items' },
    { key: 'lunch', label: 'Lunch', description: 'Midday meal items' },
    { key: 'dinner', label: 'Dinner', description: 'Evening meal items' },
  ];

  return (
    <FormPage
      title="Edit Daily Menu"
      description="Update menu meals and date"
      backHref="/menus"
      error={error}
      isLoading={isLoading}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit}
        footer={
          <FormActions
            loading={isSaving}
            cancelHref="/menus"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection title="Date" description="Day this menu applies to">
          <FormGrid>
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </FormGrid>
        </FormSection>

        {mealSections.map(({ key, label, description }) => (
          <FormSection
            key={key}
            title={label}
            description={description}
            divided
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => addMealItem(key)}>
                <Plus className="h-4 w-4" /> Add item
              </Button>
            }
          >
            <div className="space-y-3">
              {form.meals[key].length === 0 && (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border-color)] px-4 py-6 text-center text-sm text-[color:var(--color-text-secondary)]">
                  No items yet. Add an item to begin.
                </p>
              )}
              {form.meals[key].map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className={clsx(
                    surfaceNestedClass,
                    'grid grid-cols-1 gap-3 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end',
                  )}
                >
                  <Input
                    label="Item name"
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateMealItem(key, itemIdx, 'name', e.target.value)}
                  />
                  <Input
                    label="Description"
                    placeholder="Description (optional)"
                    value={item.description ?? ''}
                    onChange={(e) => updateMealItem(key, itemIdx, 'description', e.target.value)}
                  />
                  <div className="flex justify-end sm:pb-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remove ${label} item ${itemIdx + 1}`}
                      onClick={() => removeMealItem(key, itemIdx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        ))}
      </FormCard>
    </FormPage>
  );
}
