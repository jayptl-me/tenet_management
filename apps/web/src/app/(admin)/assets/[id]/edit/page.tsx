'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { FormSection, FormGrid, FormFullWidth } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  location: z.string().min(1, 'Location is required'),
  quantity: z.coerce.number().int().positive('Quantity must be positive'),
  lowStockThreshold: z.coerce.number().int().min(0, 'Threshold cannot be negative'),
  status: z.string().min(1, 'Status is required'),
  purchasedDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const categoryOptions = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];

const assetStatusOptions = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In use' },
  { value: 'under_maintenance', label: 'Under maintenance' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'retired', label: 'Retired' },
];

export default function EditAssetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`assets/${id}`)
      .json<{ success: boolean; data: FormData }>()
      .then((res) => {
        reset(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        setSubmitError('Failed to load asset');
        setIsLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await api.put(`assets/${id}`, { json: data }).json();
      router.push('/assets');
    } catch {
      setSubmitError('Failed to update asset');
    }
  };

  return (
    <FormPage
      title="Edit Asset"
      description="Update inventory item details and stock levels"
      backHref="/assets"
      error={submitError}
      isLoading={isLoading}
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/assets"
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection
          title="Asset details"
          description="Identity, category, and where this item is kept"
        >
          <FormGrid>
            <Input
              label="Name"
              placeholder="e.g. Washing machine"
              error={errors.name?.message}
              {...register('name')}
            />
            <Select
              label="Category"
              options={categoryOptions}
              error={errors.category?.message}
              {...register('category')}
            />
            <Input
              label="Location"
              placeholder="e.g. Floor 1"
              error={errors.location?.message}
              {...register('location')}
            />
            <Input
              label="Purchase date"
              type="date"
              error={errors.purchasedDate?.message}
              {...register('purchasedDate')}
            />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Inventory"
          description="Quantity on hand, reorder threshold, and condition"
          divided
        >
          <FormGrid>
            <Input
              label="Quantity"
              type="number"
              error={errors.quantity?.message}
              {...register('quantity')}
            />
            <Input
              label="Low stock threshold"
              type="number"
              error={errors.lowStockThreshold?.message}
              {...register('lowStockThreshold')}
            />
            <Select
              label="Status"
              options={assetStatusOptions}
              error={errors.status?.message}
              {...register('status')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Notes" description="Optional remarks about this asset" divided>
          <FormGrid cols={1}>
            <FormFullWidth>
              <Textarea
                label="Notes"
                rows={3}
                placeholder="Optional notes..."
                error={errors.notes?.message}
                {...register('notes')}
              />
            </FormFullWidth>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
