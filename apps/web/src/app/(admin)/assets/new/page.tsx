'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Boxes, CalendarClock, MapPin, Package } from 'lucide-react';
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
  { value: 'in_use', label: 'In use' },
  { value: 'under_maintenance', label: 'Under maintenance' },
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
    defaultValues: {
      quantity: 1,
      lowStockThreshold: 0,
      status: 'available',
      notes: '',
    },
  });

  const watchedName = useWatch({ control, name: 'name' });
  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedLocation = useWatch({ control, name: 'location' });
  const watchedQuantity = useWatch({ control, name: 'quantity' });
  const watchedThreshold = useWatch({ control, name: 'lowStockThreshold' });
  const watchedStatus = useWatch({ control, name: 'status' });
  const watchedNextService = useWatch({ control, name: 'nextServiceDate' });

  /** The category hint of the form, kept short so the field stays readable. */
  const categoryHint = watchedCategory
    ? `Grouped as ${assetCategoryLabel(watchedCategory)}`
    : undefined;

  /** The truth of the state field: a new asset in an out of service state. */
  const stateHint =
    watchedStatus === 'under_maintenance' || watchedStatus === 'damaged'
      ? 'A new asset in this state reaches nobody: the server pushes that message only on an edit.'
      : undefined;

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
      title="Register an asset"
      description="What the PG owns: the thing, where it lives, how many there are and when it is due for service"
      backHref="/assets"
      error={submitError}
      maxWidth="form"
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref="/assets"
              submitLabel="Register it"
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
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Category"
                    options={CATEGORY_OPTIONS}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={errors.category?.message}
                    helperText={categoryHint}
                  />
                )}
              />
            </FormGrid>
            <div className="mt-4 space-y-4">
              <Input
                label="Location"
                placeholder="e.g. Floor 1, Common Area"
                helperText="The free-text place. The floor and the room below are what decide who hears about this asset."
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
            description="Stock levels and the state of the thing"
            divided
          >
            <FormGrid cols={3}>
              <Input
                label="Count on hand"
                type="number"
                min={0}
                step={1}
                error={errors.quantity?.message}
                {...register('quantity')}
              />
              <Input
                label="Low stock threshold"
                type="number"
                min={0}
                step={1}
                error={errors.lowStockThreshold?.message}
                helperText="0 disables the alert"
                {...register('lowStockThreshold')}
              />
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    label="State"
                    options={STATUS_OPTIONS}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={errors.status?.message}
                    helperText={stateHint}
                  />
                )}
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

        <div className="space-y-6 lg:sticky lg:top-6">
          <DetailCard
            title="Preview"
            icon={<AssetCategoryIcon category={watchedCategory} className="h-4 w-4" />}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-(--radius-lg) border border-(--border-color) bg-(--color-field-bg) text-(--color-text-secondary) [&_svg]:h-5 [&_svg]:w-5">
                <AssetCategoryIcon category={watchedCategory} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-(--color-text-primary)">
                  {watchedName?.trim() || 'Untitled asset'}
                </p>
                <p className="text-xs font-medium text-(--color-text-muted)">
                  {assetCategoryLabel(watchedCategory)}
                </p>
              </div>
            </div>
            <DetailList className="mt-3">
              <DetailRow
                label="Placement"
                value={
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    {watchedLocation?.trim() || '-'}
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

          {/* What the save commits. The rule of the house: the page says what
              the server does, or it does not promise anything. */}
          <DetailCard title="What the save commits" icon={<Package />}>
            <ul className="text-2xs space-y-2 font-medium text-(--color-text-secondary)">
              <li>
                {'The asset record, with the name, the category, the location, the floor and the room you picked, the count, the threshold, the state and the three dates.'}
              </li>
              <li>
                {'A create entry in the audit log with the name, the category and the count.'}
              </li>
              <li>
                {'Nothing else: no bill, no message, no task. The count you give is what the low stock set is built from, and the next service date is what puts the asset on the service due list thirty days before it falls due.'}
              </li>
              <li className="font-semibold text-(--color-text-primary)">
                {'Nobody is told. An asset registered already out of service does not reach the residents of its room: the server pushes that message only when an edit moves the state of an existing asset.'}
              </li>
            </ul>
          </DetailCard>

          {/* What the save refuses. */}
          <DetailCard title="What the save refuses" icon={<Boxes />}>
            <ul className="text-2xs space-y-2 font-medium text-(--color-text-secondary)">
              <li>{'A name under two characters or over 120, and a location that is empty.'}</li>
              <li>{'A category outside the five the register holds.'}</li>
              <li>{'A count or a threshold below zero, and a count that is not a whole number.'}</li>
              <li>{'A date the server cannot read.'}</li>
              <li>
                {'A floor or a room id the server cannot resolve: it casts the id without checking it, so a bad id fails the write instead of naming the bad field.'}
              </li>
            </ul>
          </DetailCard>
        </div>
      </div>
    </FormPage>
  );
}
