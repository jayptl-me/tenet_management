'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, AlertTriangle, MapPin, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
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
  lowStockThreshold: z.coerce.number().int().min(0, 'Threshold cannot be negative'),
  status: z.enum(['available', 'in_use', 'under_maintenance', 'damaged', 'retired']),
  purchasedDate: z.string().optional(),
  lastServicedDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
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
  { value: 'retired', label: 'Retired (terminal)' },
];

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
  purchasedDate?: string;
  lastServicedDate?: string;
  nextServiceDate?: string;
  notes?: string;
}

function toDateInput(value?: string): string {
  return value ? String(value).slice(0, 10) : '';
}

export default function EditAssetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [loaded, setLoaded] = useState<AssetDetail | null>(null);
  const [retireOpen, setRetireOpen] = useState(false);
  const [retiring, setRetiring] = useState(false);

  const {
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

  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedQuantity = useWatch({ control, name: 'quantity' });
  const watchedThreshold = useWatch({ control, name: 'lowStockThreshold' });
  const watchedStatus = useWatch({ control, name: 'status' });
  const watchedNextService = useWatch({ control, name: 'nextServiceDate' });
  const watchedLastService = useWatch({ control, name: 'lastServicedDate' });
  const watchedPurchased = useWatch({ control, name: 'purchasedDate' });

  useEffect(() => {
    if (!id) return;
    api
      .get(`assets/${id}`)
      .json<{ success: boolean; data: AssetDetail }>()
      .then((res) => {
        const d = res.data;
        setLoaded(d);
        reset({
          name: d.name ?? '',
          category: (d.category as FormData['category']) ?? 'other',
          location: d.location ?? '',
          quantity: d.quantity ?? 1,
          lowStockThreshold: d.lowStockThreshold ?? 0,
          status: (d.status as FormData['status']) ?? 'available',
          purchasedDate: toDateInput(d.purchasedDate),
          lastServicedDate: toDateInput(d.lastServicedDate),
          nextServiceDate: toDateInput(d.nextServiceDate),
          notes: d.notes ?? '',
          floorId:
            d.floorId == null
              ? ''
              : typeof d.floorId === 'string'
                ? d.floorId
                : (d.floorId._id ?? ''),
          roomId:
            d.roomId == null ? '' : typeof d.roomId === 'string' ? d.roomId : (d.roomId._id ?? ''),
        });
        setIsLoading(false);
      })
      .catch(async (err) => {
        setSubmitError((await parseApiError(err)).message);
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
      router.push(`/assets/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const handleRetire = async () => {
    setRetiring(true);
    try {
      await api.delete(`assets/${id}`).json();
      toast.success('Asset retired');
      router.push('/assets');
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setRetiring(false);
      setRetireOpen(false);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const isRetired = (watchedStatus ?? loaded?.status) === 'retired';

  return (
    <FormPage
      title="Edit Asset"
      description="Update asset details, inventory, and service schedule"
      backHref={`/assets/${id}`}
      error={submitError}
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        loaded ? (
          <StatusBadge
            variant={statusToVariant(watchedStatus ?? loaded.status)}
            label={(watchedStatus ?? loaded.status).replace(/_/g, ' ')}
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
                helperText={
                  watchedCategory ? `Grouped as ${assetCategoryLabel(watchedCategory)}` : undefined
                }
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
                helperText="Alert fires when quantity falls to this level (0 disables)"
                {...register('lowStockThreshold')}
              />
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                error={err.status?.message}
                helperText={isRetired ? 'Retired is terminal: service schedule closes' : undefined}
                {...register('status')}
              />
            </FormGrid>
          </FormSection>

          <FormSection title="Dates" description="Purchase and service schedule" divided>
            <FormGrid cols={3}>
              <DatePicker
                label="Purchase date"
                error={err.purchasedDate?.message}
                {...register('purchasedDate')}
              />
              <DatePicker
                label="Last serviced"
                error={err.lastServicedDate?.message}
                {...register('lastServicedDate')}
              />
              <DatePicker
                label="Next service due"
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

        <div className="space-y-6 lg:sticky lg:top-6">
          <DetailCard
            title="Live summary"
            icon={
              <AssetCategoryIcon
                category={watchedCategory ?? loaded?.category}
                className="h-4 w-4"
              />
            }
          >
            <DetailList>
              <DetailRow
                label="Category"
                value={assetCategoryLabel(watchedCategory ?? loaded?.category)}
              />
              <DetailRow
                label="Next service"
                value={formatShortDate(
                  watchedNextService
                    ? new Date(`${watchedNextService}T00:00:00.000Z`).toISOString()
                    : loaded?.nextServiceDate,
                )}
              />
              <DetailRow
                label="Placement"
                value={
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {loaded?.location ?? '—'}
                  </span>
                }
              />
            </DetailList>
            <AssetStockMeter
              quantity={Number(watchedQuantity ?? loaded?.quantity ?? 0)}
              threshold={Number(watchedThreshold ?? loaded?.lowStockThreshold ?? 0)}
              className="mt-3"
            />
          </DetailCard>

          <DetailCard title="Service timeline" icon={<CalendarClock />}>
            <AssetServiceTimeline
              purchasedDate={
                watchedPurchased
                  ? new Date(`${watchedPurchased}T00:00:00.000Z`).toISOString()
                  : loaded?.purchasedDate
              }
              lastServicedDate={
                watchedLastService
                  ? new Date(`${watchedLastService}T00:00:00.000Z`).toISOString()
                  : loaded?.lastServicedDate
              }
              nextServiceDate={
                watchedNextService
                  ? new Date(`${watchedNextService}T00:00:00.000Z`).toISOString()
                  : loaded?.nextServiceDate
              }
              status={watchedStatus ?? loaded?.status}
            />
          </DetailCard>

          {loaded?.status !== 'retired' && (
            <DetailCard title="Danger zone" variant="danger" icon={<AlertTriangle />}>
              <p className="text-[13px] leading-relaxed font-medium text-[color:var(--color-danger-700)]">
                Retiring closes the service schedule. The record is kept, not deleted.
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
        title="Retire asset"
        message={`Retire "${loaded?.name ?? 'this asset'}"? The asset will be marked as retired (not permanently deleted).`}
        loading={retiring}
        onConfirm={handleRetire}
        onCancel={() => setRetireOpen(false)}
      />
    </FormPage>
  );
}
