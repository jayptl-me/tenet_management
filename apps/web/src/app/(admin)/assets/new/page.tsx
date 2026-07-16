'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  category: z.enum(['furniture', 'appliance', 'electronics', 'cleaning', 'other']),
  location: z.string().min(1, 'Location is required').max(160),
  quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
  lowStockThreshold: z.coerce.number().int().min(0, 'Must be >= 0'),
  status: z.enum(['available', 'in_use', 'under_maintenance', 'damaged', 'retired']),
  purchasedDate: z.string().optional(),
  lastServicedDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  notes: z.string().max(500).optional(),
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
      const payload: Record<string, unknown> = {
        name: data.name,
        category: data.category,
        location: data.location,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold,
        status: data.status,
        notes: data.notes || undefined,
      };
      if (data.purchasedDate) {
        payload.purchasedDate = new Date(`${data.purchasedDate}T00:00:00.000Z`).toISOString();
      }
      if (data.lastServicedDate) {
        payload.lastServicedDate = new Date(
          `${data.lastServicedDate}T00:00:00.000Z`,
        ).toISOString();
      }
      if (data.nextServiceDate) {
        payload.nextServiceDate = new Date(`${data.nextServiceDate}T00:00:00.000Z`).toISOString();
      }
      await api.post('assets', { json: payload }).json<{ success: boolean }>();
      router.push('/assets');
    } catch {
      setSubmitError('Failed to create asset. Please try again.');
    }
  };

  return (
    <FormPage
      title="New Asset"
      description="Add a new asset to inventory"
      backHref="/assets"
      error={submitError}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/assets"
            submitLabel="Save Asset"
            divided={false}
          />
        }
      >
        <div className="space-y-5">
          <FormGrid>
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
          </FormGrid>
          <Input
            label="Location"
            placeholder="e.g. Floor 1, Common Area"
            error={errors.location?.message}
            {...register('location')}
          />
          <FormGrid cols={3}>
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
          </FormGrid>
          <FormGrid cols={3}>
            <Input
              label="Purchase date"
              type="date"
              error={errors.purchasedDate?.message}
              {...register('purchasedDate')}
            />
            <Input
              label="Last serviced"
              type="date"
              error={errors.lastServicedDate?.message}
              {...register('lastServicedDate')}
            />
            <Input
              label="Next service"
              type="date"
              error={errors.nextServiceDate?.message}
              {...register('nextServiceDate')}
            />
          </FormGrid>
          <Textarea
            label="Notes"
            rows={3}
            placeholder="Optional notes..."
            error={errors.notes?.message}
            {...register('notes')}
          />
        </div>
      </FormCard>
    </FormPage>
  );
}
