'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['furniture', 'appliance', 'electronics', 'cleaning', 'other']),
  location: z.string().min(1, 'Location is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  lowStockThreshold: z.coerce.number().min(0, 'Must be >= 0'),
  status: z.enum(['available', 'in_use', 'under_maintenance', 'damaged', 'retired']),
  purchasedDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CATEGORY_OPTIONS = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

export default function NewAssetPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, lowStockThreshold: 0, notes: '' },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.post('assets', { json: data }).json<{ success: boolean }>();
      router.push('/assets');
    } catch {
      setSubmitError('Failed to create asset. Please try again.');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">New Asset</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Add a new asset to inventory</p>
        </div>
      </div>

      {submitError && <ErrorBanner message={submitError} />}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              placeholder="Asset name"
              error={errors.name?.message}
              {...register('name')}
            />
            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              error={errors.category?.message}
              {...register('category')}
            />
          </div>
          <Input
            label="Location"
            placeholder="e.g. Floor 1, Common Area"
            error={errors.location?.message}
            {...register('location')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Quantity"
              type="number"
              error={errors.quantity?.message}
              {...register('quantity')}
            />
            <Input
              label="Low Stock Threshold"
              type="number"
              error={errors.lowStockThreshold?.message}
              {...register('lowStockThreshold')}
            />
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              error={errors.status?.message}
              {...register('status')}
            />
          </div>
          <Input
            label="Purchase Date"
            type="date"
            error={errors.purchasedDate?.message}
            {...register('purchasedDate')}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-surface-800 font-display text-sm font-semibold">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              className="text-surface-900 font-[family:var(--font-body)] focus:ring-brand-500 w-full rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-base focus:outline-none focus:ring-[length:var(--bw-strong)] focus:ring-offset-2"
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>
        </div>
        <div className="border-surface-200 mt-8 flex items-center justify-end gap-3 border-t-2 pt-5">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Asset
          </Button>
        </div>
      </form>
    </div>
  );
}
