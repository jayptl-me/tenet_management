'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, CalendarClock, FileText, MapPin, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { floorLabel, roomLabel, roomSublabel } from '@/lib/resource-select-presets';
import {
  AssetCategoryIcon,
  AssetServiceTimeline,
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
  { value: 'retired', label: 'Retired (terminal)' },
];

// The assets list, the band and the asset record live under the same
// `['assets']` prefix, so one invalidation re-reads every asset view.
const ASSETS_PREFIX = ['assets'] as const;

interface AssetDetail {
  _id: string;
  name: string;
  category: string;
  location: string;
  floorId?: { _id?: string; label?: string; floorNumber?: number } | string | null;
  roomId?: { _id?: string; roomNumber?: string } | string | null;
  quantity: number;
  lowStockThreshold: number;
  status: string;
  purchasedDate?: string | null;
  lastServicedDate?: string | null;
  nextServiceDate?: string | null;
  notes?: string;
}

function toDateInput(value?: string | null): string {
  return value ? String(value).slice(0, 10) : '';
}

/** The id of a floor or a room reference, populated or not. */
function refId(value: { _id?: string } | string | null | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : (value._id ?? '');
}

export default function EditAssetPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [submitError, setSubmitError] = useState('');
  const [retireOpen, setRetireOpen] = useState(false);
  const [retiring, setRetiring] = useState(false);

  /**
   * The record, read through the shared query stack, like every other record:
   * the load takes part in the cache and a write invalidates it.
   */
  const { data: fetchedAsset = null, error: queryError } = useApiQuery<AssetDetail>(
    ['assets', id],
    `assets/${id}`,
    { enabled: Boolean(id) },
  );

  const asset = fetchedAsset && !Array.isArray(fetchedAsset) ? fetchedAsset : null;
  // The skeleton is shown while the record is still on its way. It is derived
  // from the query, so a record that never arrives shows the error state
  // instead of a page that spins for ever.
  const isLoading = !asset && !queryError;

  const {
    setValue,
    register,
    control,
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
  const watchedPurchasedDate = useWatch({ control, name: 'purchasedDate' }) ?? '';
  const watchedLastServicedDate = useWatch({ control, name: 'lastServicedDate' }) ?? '';
  const watchedNextServiceDate = useWatch({ control, name: 'nextServiceDate' }) ?? '';
  // The id whose values are already in the form. A refetch of the same record
  // must never wipe what the operator is typing.
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!asset || loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    reset({
      name: asset.name ?? '',
      category: (asset.category as FormData['category']) ?? 'other',
      location: asset.location ?? '',
      quantity: asset.quantity ?? 1,
      lowStockThreshold: asset.lowStockThreshold ?? 0,
      status: (asset.status as FormData['status']) ?? 'available',
      purchasedDate: toDateInput(asset.purchasedDate),
      lastServicedDate: toDateInput(asset.lastServicedDate),
      nextServiceDate: toDateInput(asset.nextServiceDate),
      notes: asset.notes ?? '',
      floorId: refId(asset.floorId),
      roomId: refId(asset.roomId),
    });
  }, [asset, id, reset]);

  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedQuantity = useWatch({ control, name: 'quantity' });
  const watchedThreshold = useWatch({ control, name: 'lowStockThreshold' });
  const watchedStatus = useWatch({ control, name: 'status' });
  const watchedNextService = useWatch({ control, name: 'nextServiceDate' });
  const watchedLastService = useWatch({ control, name: 'lastServicedDate' });
  const watchedPurchased = useWatch({ control, name: 'purchasedDate' });

  /** The category hint of the form, kept short so the field stays readable. */
  const categoryHint = watchedCategory
    ? `Grouped as ${assetCategoryLabel(watchedCategory)}`
    : undefined;

  /** The truth of the state field: which move reaches the residents. */
  const stateHint =
    watchedStatus === 'retired'
      ? 'Retired is terminal: the service schedule closes'
      : watchedStatus === 'under_maintenance' || watchedStatus === 'damaged'
        ? 'This state reaches the residents of the room, or of the floor'
        : undefined;

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      // Always send date keys as strings. Empty string clears the date (the API
      // turns an empty date into null).
      const payload: Record<string, unknown> = {
        name: data.name,
        category: data.category,
        location: data.location,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold,
        status: data.status,
        purchasedDate: data.purchasedDate
          ? new Date(`${data.purchasedDate}T00:00:00.000Z`).toISOString()
          : '',
        lastServicedDate: data.lastServicedDate
          ? new Date(`${data.lastServicedDate}T00:00:00.000Z`).toISOString()
          : '',
        nextServiceDate: data.nextServiceDate
          ? new Date(`${data.nextServiceDate}T00:00:00.000Z`).toISOString()
          : '',
        notes: data.notes || undefined,
        floorId: data.floorId || '',
        roomId: data.roomId || '',
      };

      await api.put(`assets/${id}`, { json: payload }).json();
      // Invalidate before the navigation: the destination page must show the
      // server's state, and a navigation unmounts this page.
      await queryClient.invalidateQueries({ queryKey: ASSETS_PREFIX });
      router.push(`/assets/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const handleRetire = async () => {
    setRetiring(true);
    setSubmitError('');
    try {
      await api.delete(`assets/${id}`).json();
      await queryClient.invalidateQueries({ queryKey: ASSETS_PREFIX });
      router.push('/assets');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    } finally {
      setRetiring(false);
      setRetireOpen(false);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const retireMessage = `The server keeps the record of "${asset?.name ?? 'this asset'}" and sets its state to retired, so it leaves the service due list. It writes an update entry in the audit log and sends no message: nobody is told that the item left the register.`;

  return (
    <FormPage
      title="Edit asset"
      description="What the PG owns: the thing, where it lives, how many there are and when it is due for service"
      backHref={`/assets/${id}`}
      error={submitError || errorMessage(queryError)}
      isLoading={isLoading}
      maxWidth="form"
      badge={
        asset ? (
          <StatusBadge
            variant={statusToVariant(watchedStatus ?? asset.status)}
            label={(watchedStatus ?? asset.status).replace(/_/g, ' ')}
          />
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <FormCard
          onSubmit={handleSubmit(onSubmit)}
          footer={
            <FormActions
              loading={isSubmitting}
              cancelHref={`/assets/${id}`}
              submitLabel="Save the changes"
              divided={false}
            />
          }
        >
          <FormSection
            title="Identity"
            icon={<AssetCategoryIcon category={watchedCategory} className="h-4 w-4" />}
            description="What the asset is and where it lives"
          >
            <FormGrid>
              <Input
                label="Name"
                placeholder="Asset name"
                error={err.name?.message}
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
                    error={err.category?.message}
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
                error={err.location?.message}
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
            description="The count, the threshold and the state of the thing"
            divided
          >
            <FormGrid cols={3}>
              <Input
                label="Count on hand"
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
                helperText="The alert fires when the count reaches this level (0 disables it)"
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
                    error={err.status?.message}
                    helperText={stateHint}
                  />
                )}
              />
            </FormGrid>
          </FormSection>

          <FormSection title="Service schedule" description="Purchase and service dates" divided>
            <FormGrid cols={3}>
              <DatePicker
                label="Purchase date"
                error={err.purchasedDate?.message}

                name="purchasedDate"
                value={watchedPurchasedDate}
                onChange={(value) => setValue('purchasedDate', value, { shouldValidate: true })}
              />
              <DatePicker
                label="Last serviced"
                error={err.lastServicedDate?.message}

                name="lastServicedDate"
                value={watchedLastServicedDate}
                onChange={(value) => setValue('lastServicedDate', value, { shouldValidate: true })}
              />
              <DatePicker
                label="Next service due"
                error={err.nextServiceDate?.message}

                name="nextServiceDate"
                value={watchedNextServiceDate}
                onChange={(value) => setValue('nextServiceDate', value, { shouldValidate: true })}
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

        <div className="space-y-6 lg:sticky lg:top-6">
          <DetailCard
            title="Live summary"
            icon={
              <AssetCategoryIcon
                category={watchedCategory ?? asset?.category}
                className="h-4 w-4"
              />
            }
          >
            <DetailList>
              <DetailRow
                label="Category"
                value={assetCategoryLabel(watchedCategory ?? asset?.category)}
              />
              <DetailRow
                label="Next service"
                value={formatShortDate(
                  watchedNextService
                    ? new Date(`${watchedNextService}T00:00:00.000Z`).toISOString()
                    : asset?.nextServiceDate,
                )}
              />
              <DetailRow
                label="Placement"
                value={
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-(--color-text-muted)" />
                    {asset?.location ?? '-'}
                  </span>
                }
              />
            </DetailList>
            <AssetStockMeter
              quantity={Number(watchedQuantity ?? asset?.quantity ?? 0)}
              threshold={Number(watchedThreshold ?? asset?.lowStockThreshold ?? 0)}
              className="mt-3"
            />
          </DetailCard>

          <DetailCard title="Service timeline" icon={<CalendarClock />}>
            <AssetServiceTimeline
              purchasedDate={
                watchedPurchased
                  ? new Date(`${watchedPurchased}T00:00:00.000Z`).toISOString()
                  : asset?.purchasedDate
              }
              lastServicedDate={
                watchedLastService
                  ? new Date(`${watchedLastService}T00:00:00.000Z`).toISOString()
                  : asset?.lastServicedDate
              }
              nextServiceDate={
                watchedNextService
                  ? new Date(`${watchedNextService}T00:00:00.000Z`).toISOString()
                  : asset?.nextServiceDate
              }
              status={watchedStatus ?? asset?.status}
            />
          </DetailCard>

          {/* What the save moves, and who hears about it. */}
          <DetailCard title="What the save moves" icon={<FileText />}>
            <ul className="text-2xs space-y-2 font-medium text-(--color-text-secondary)">
              <li>
                {
                  'The fields of the record, and an update entry in the audit log that names the fields that moved.'
                }
              </li>
              <li className="font-semibold text-(--color-text-primary)">
                {
                  'The residents of the room, or of the floor, hear about it once and only once: when the save moves the state into under maintenance or damaged, the server pushes a service_update to the active residents of that place.'
                }
              </li>
              <li>
                {
                  'Everything else is silent: a move to another room, a new count, a new service date and a move back to available or in use reach nobody.'
                }
              </li>
              <li>
                {
                  'The save refuses a name under two characters, a category outside the five, an empty location, a count or a threshold below zero and a date the server cannot read.'
                }
              </li>
            </ul>
          </DetailCard>

          {asset?.status !== 'retired' && (
            <DetailCard title="Danger zone" variant="danger" icon={<AlertTriangle />}>
              <p className="text-13 leading-relaxed font-medium text-(--color-danger-700)">
                {
                  'Retiring closes the service schedule. The record is kept, not deleted, and nobody is told that the item left the register.'
                }
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={() => setRetireOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Retire asset
              </Button>
            </DetailCard>
          )}
        </div>
      </div>

      <ConfirmModal
        open={retireOpen}
        title="Retire this asset"
        message={retireMessage}
        confirmLabel="Retire it"
        loading={retiring}
        onConfirm={handleRetire}
        onCancel={() => setRetireOpen(false)}
      />
    </FormPage>
  );
}
