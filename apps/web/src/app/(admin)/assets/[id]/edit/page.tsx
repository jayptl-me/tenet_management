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
import { FormSection, FormGrid } from '@/components/ui/FormSection';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  category: z.enum(['furniture', 'appliance', 'electronics', 'cleaning', 'other']),
  location: z.string().min(1, 'Location is required').max(160),
  quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
  lowStockThreshold: z.coerce.number().int().min(0, 'Threshold cannot be negative'),
  status: z.enum(['available', 'in_use', 'under_maintenance', 'damaged', 'retired']),
  purchasedDate: z.string().optional(),
  lastServicedDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
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

interface AssetDetail {
  name: string;
  category: string;
  location: string;
  quantity: number;
  lowStockThreshold: number;
  status: string;
  purchasedDate?: string;
  lastServicedDate?: string;
  nextServiceDate?: string;
  notes?: string;
}

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
    defaultValues: {
      quantity: 1,
      lowStockThreshold: 0,
      status: 'available',
      notes: '',
    },
  });

  useEffect(() => {
    if (!id) return;
    api
      .get(`assets/${id}`)
      .json<{ success: boolean; data: AssetDetail }>()
      .then((res) => {
        const d = res.data;
        reset({
          name: d.name ?? '',
          category: (d.category as FormData['category']) ?? 'other',
          location: d.location ?? '',
          quantity: d.quantity ?? 1,
          lowStockThreshold: d.lowStockThreshold ?? 0,
          status: (d.status as FormData['status']) ?? 'available',
          purchasedDate: d.purchasedDate ? String(d.purchasedDate).slice(0, 10) : '',
          lastServicedDate: d.lastServicedDate ? String(d.lastServicedDate).slice(0, 10) : '',
          nextServiceDate: d.nextServiceDate ? String(d.nextServiceDate).slice(0, 10) : '',
          notes: d.notes ?? '',
        });
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
      // Always send date keys as strings. Empty string clears the date (API optionalDateString -> null).
      const payload: Record<string, unknown> = {
        name: data.name,
        category: data.category,
        location: data.location,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold,
        status: data.status,
        purchasedDate: data.purchasedDate
          ? new Date(data.purchasedDate).toISOString()
          : '',
        lastServicedDate: data.lastServicedDate
          ? new Date(data.lastServicedDate).toISOString()
          : '',
        nextServiceDate: data.nextServiceDate
          ? new Date(data.nextServiceDate).toISOString()
          : '',
        notes: data.notes || undefined,
      };

      await api.put(`assets/${id}`, { json: payload }).json();
      router.push('/assets');
    } catch {
      setSubmitError('Failed to update asset');
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Edit Asset"
      description="Update asset details, inventory, and service schedule"
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
        <FormSection title="Identification" description="Basic asset identity and categorization">
          <FormGrid>
            <Input
              label="Name"
              placeholder="Asset name"
              error={err.name?.message}
              {...register('name')}
            />
            <Select
              label="Category"
              options={CATEGORY_OPTIONS}
              error={err.category?.message}
              {...register('category')}
            />
          </FormGrid>
        </FormSection>

        <FormSection
          title="Inventory & location"
          description="Where the asset is and how many are available"
          divided
        >
          <FormGrid>
            <Input
              label="Location"
              placeholder="e.g. Floor 1, Common Area"
              error={err.location?.message}
              {...register('location')}
            />
            <Input
              label="Quantity"
              type="number"
              min={0}
              step={1}
              error={err.quantity?.message}
              {...register('quantity')}
            />
            <Input
              label="Low stock threshold"
              type="number"
              min={0}
              step={1}
              error={err.lowStockThreshold?.message}
              {...register('lowStockThreshold')}
            />
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              error={err.status?.message}
              {...register('status')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Dates" description="Purchase and service schedule" divided>
          <FormGrid cols={3}>
            <Input
              label="Purchase date"
              type="date"
              error={err.purchasedDate?.message}
              {...register('purchasedDate')}
            />
            <Input
              label="Last serviced"
              type="date"
              error={err.lastServicedDate?.message}
              {...register('lastServicedDate')}
            />
            <Input
              label="Next service due"
              type="date"
              error={err.nextServiceDate?.message}
              {...register('nextServiceDate')}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Notes" divided>
          <Textarea
            label="Notes"
            rows={3}
            placeholder="Optional notes..."
            error={err.notes?.message}
            {...register('notes')}
          />
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
