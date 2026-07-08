'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

interface MealSection {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  items: { name: string; description?: string }[];
}

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
    api.get(`menus/${id}`).json<{ success: boolean; data: MenuFormState }>()
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
      .catch(() => { setError('Failed to load menu'); setIsLoading(false); });
  }, [id]);

  const updateMealItem = (mealKey: 'breakfast' | 'lunch' | 'dinner', itemIndex: number, field: 'name' | 'description', value: string) => {
    setForm((prev) => ({
      ...prev,
      meals: {
        ...prev.meals,
        [mealKey]: prev.meals[mealKey].map((item, i) =>
          i === itemIndex ? { ...item, [field]: value } : item
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
      items.some((item) => !item.name.trim())
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
          breakfast: form.meals.breakfast.filter((i) => i.name.trim()).map((i) => ({
            name: i.name.trim(),
            ...(i.description?.trim() ? { description: i.description.trim() } : {}),
          })),
          lunch: form.meals.lunch.filter((i) => i.name.trim()).map((i) => ({
            name: i.name.trim(),
            ...(i.description?.trim() ? { description: i.description.trim() } : {}),
          })),
          dinner: form.meals.dinner.filter((i) => i.name.trim()).map((i) => ({
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

  const mealSections: { key: 'breakfast' | 'lunch' | 'dinner'; label: string }[] = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'dinner', label: 'Dinner' },
  ];

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div>
          <h2 className="font-[family:var(--font-display)] text-[color:var(--color-text-primary)] text-2xl font-extrabold">Edit Daily Menu</h2>
          <p className="text-[color:var(--color-text-muted)] mt-0.5 text-sm">Update menu meals and date</p>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </section>

        {mealSections.map(({ key, label }) => (
          <section key={key} className="space-y-4 rounded-[var(--radius-lg)] border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-[color:var(--color-surface-900)] text-lg font-bold capitalize">{label}</h3>
            <div className="space-y-2">
              {form.meals[key].map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => updateMealItem(key, itemIdx, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={item.description ?? ''}
                      onChange={(e) => updateMealItem(key, itemIdx, 'description', e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMealItem(key, itemIdx)}
                    className="text-[color:var(--color-danger-500)] hover:bg-[color:var(--color-danger-50)] rounded-md p-2 mt-1 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => addMealItem(key)}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </section>
        ))}

        <div className="flex items-center gap-4">
          <Button type="submit" loading={isSaving} size="lg">
            <Save className="h-5 w-5" /> Save Changes
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
