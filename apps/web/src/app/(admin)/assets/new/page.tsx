'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, Boxes, CalendarClock, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { floorLabel, roomLabel, roomSublabel } from '@/lib/resource-select-presets';
import {
  AssetCategoryIcon,
  AssetStockMeter,
  assetCategoryLabel,
  formatShortDate,
} from '@/components/ui/AssetVisuals';

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
  floorId: z.string().optional(),
  roomId: z.string().optional(),
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
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, lowStockThreshold: 0, notes: '' },
  });

  const watchedName = useWatch({ control, name: 'name' });
  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedLocation = useWatch({ control, name: 'location' });
  const watchedQuantity = useWatch({ control, name: 'quantity' });
  const watchedThreshold = useWatch({ control, name: 'lowStockThreshold' });
  const watchedNextService = useWatch({ control, name: 'nextServiceDate' });

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        category: data.category,
        location: data.location,
        floorId: data.floorId || undefined,
        roomId: data.roomId || undefined,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold,
        status: data.status,
        notes: data.notes || undefined,
      };
      if (data.purchasedDate) {
        payload.purchasedDate = new Date(`${data.purchasedDate}T00:00:00.000Z`).toISOString();
      }
      if (data.lastServicedDate) {
        payload.lastServicedDate = new Date(`${data.lastServicedDate}T00:00:00.000Z`).toISOString();
      }
      if (data.nextServiceDate) {
        payload.nextServiceDate = new Date(`${data.nextServiceDate}T00:00:00.000Z`).toISOString();
      }
      const res = await api
        .post('assets', { json: payload })
        .json<{ success: boolean; data: { _id?: string; id?: string } }>();
      const createdId = res.data?.id ?? res.data?._id;
      router.push(createdId ? `/assets/${createdId}` : '/assets');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  return (
    <FormPage
      title="New Asset"
      description="Add a new asset to inventory"
      backHref="/assets"
      error={submitError}
      maxWidth="4xl"
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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
          <FormSection
            title="Identity"
            icon={<Package />}
            description="What the asset is and where it lives"
          >
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
                helperText={
                  watchedCategory ? `Grouped as ${assetCategoryLabel(watchedCategory)}` : undefined
                }
                {...register('category')}
              />
            </FormGrid>
            <div className="mt-4 space-y-4">
              <Input
                label="Location"
                placeholder="e.g. Floor 1, Common Area"
                error={errors.location?.message}
                {...register('location')}
              />
              <FormGrid>
                <Controller
                  name="floorId"
                  control={control}
                  render={({ field }) => (
                    <ResourceSelect
                      label="Floor (optional)"
                      endpoint="floors"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select floor..."
                      labelKey={floorLabel}
                      dataPath="data"
                    />
                  )}
                />
                <Controller
                  name="roomId"
                  control={control}
                  render={({ field }) => (
                    <ResourceSelect
                      label="Room (optional)"
                      endpoint="rooms?isActive=true"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Select room..."
                      valueKey="_id"
                      labelKey={roomLabel}
                      sublabelFn={roomSublabel}
                      dataPath="data"
                    />
                  )}
                />
              </FormGrid>
            </div>
          </FormSection>
          <FormSection
            title="Inventory"
            icon={<Boxes />}
            description="Stock levels and status"
            divided
          >
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
                helperText="0 disables the alert"
                {...register('lowStockThreshold')}
              />
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                error={errors.status?.message}
                {...register('status')}
              />
            </FormGrid>
          </FormSection>
          <FormSection
            title="Service schedule"
            icon={<CalendarClock />}
            description="Purchase and maintenance dates"
            divided
          >
            <FormGrid cols={3}>
              <DatePicker
                label="Purchase date"
                error={errors.purchasedDate?.message}
                {...register('purchasedDate')}
              />
              <DatePicker
                label="Last serviced"
                error={errors.lastServicedDate?.message}
                {...register('lastServicedDate')}
              />
              <DatePicker
                label="Next service"
                error={errors.nextServiceDate?.message}
                {...register('nextServiceDate')}
              />
            </FormGrid>
          </FormSection>
          <FormSection title="Notes" description="Optional remarks" divided>
            <Textarea
              label="Notes"
              rows={3}
              placeholder="Optional notes..."
              error={errors.notes?.message}
              {...register('notes')}
            />
          </FormSection>
        </FormCard>

        <DetailCard
          title="Preview"
          icon={<AssetCategoryIcon category={watchedCategory} className="h-4 w-4" />}
          className="lg:sticky lg:top-6"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] [&_svg]:h-5 [&_svg]:w-5">
              <AssetCategoryIcon category={watchedCategory} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[color:var(--color-text-primary)]">
                {watchedName?.trim() || 'Untitled asset'}
              </p>
              <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                {assetCategoryLabel(watchedCategory)}
              </p>
            </div>
          </div>
          <DetailList className="mt-3">
            <DetailRow
              label="Placement"
              value={
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                  {watchedLocation?.trim() || '—'}
                </span>
              }
            />
            <DetailRow
              label="Next service"
              value={formatShortDate(
                watchedNextService
                  ? new Date(`${watchedNextService}T00:00:00.000Z`).toISOString()
                  : undefined,
              )}
            />
          </DetailList>
          <AssetStockMeter
            quantity={Number(watchedQuantity ?? 1)}
            threshold={Number(watchedThreshold ?? 0)}
            className="mt-3"
          />
        </DetailCard>
      </div>
    </FormPage>
  );
}
