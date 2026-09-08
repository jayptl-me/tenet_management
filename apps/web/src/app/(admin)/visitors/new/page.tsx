'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserRound,
  Phone,
  DoorOpen,
  CalendarDays,
  Clock,
  BedDouble,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { Input } from '@/components/ui/Input';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { tenantLabel } from '@/lib/resource-select-presets';

const PURPOSE_OPTIONS = [
  'Family Visit',
  'Friend Visit',
  'Delivery',
  'Maintenance',
  'Interview',
  'Official Work',
];

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  visitorName: z.string().min(2, 'Visitor name must be at least 2 characters').max(100),
  visitorPhone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  purpose: z.string().min(1, 'Purpose is required').max(200),
  expectedArrival: z.string().min(1, 'Expected arrival is required'),
});

type FormData = z.infer<typeof schema>;

interface TenantPreview {
  name: string;
  phone?: string;
  roomNumber?: string;
  bedId?: string;
  floorLabel?: string;
  isActive?: boolean;
}

function arrivalSummary(value: string): { label: string; detail: string; isPast: boolean } | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  const time = target.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const day = target.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return {
      label: `Overdue by ${n} day${n === 1 ? '' : 's'}`,
      detail: `${day} at ${time}`,
      isPast: true,
    };
  }
  if (diffDays === 0)
    return { label: 'Today', detail: `Today at ${time}`, isPast: target.getTime() < now.getTime() };
  if (diffDays === 1) return { label: 'Tomorrow', detail: `Tomorrow at ${time}`, isPast: false };
  return { label: `In ${diffDays} days`, detail: `${day} at ${time}`, isPast: false };
}

export default function NewVisitorPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState('');
  const [hostPreview, setHostPreview] = useState<TenantPreview | null>(null);
  const [hostLoading, setHostLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const tenantIdWatch = useWatch({ control, name: 'tenantId' });
  const purposeWatch = useWatch({ control, name: 'purpose' });
  const arrivalWatch = useWatch({ control, name: 'expectedArrival' });
  const summary = arrivalSummary(arrivalWatch ?? '');

  const onTenantChange = async (tenantId: string) => {
    setValue('tenantId', tenantId);
    setHostPreview(null);
    if (!tenantId) return;
    setHostLoading(true);
    try {
      const res = await api.get(`tenants/${tenantId}`).json<{
        success: boolean;
        data: {
          user?: { name?: string; phone?: string };
          room?: { roomNumber?: string; floor?: { label?: string } };
          bedId?: string;
          isActive?: boolean;
        };
      }>();
      const d = res.data;
      setHostPreview({
        name: d.user?.name ?? 'Unknown',
        phone: d.user?.phone,
        roomNumber: d.room?.roomNumber,
        bedId: d.bedId,
        floorLabel: d.room?.floor?.label,
        isActive: d.isActive,
      });
    } catch {
      setHostPreview(null);
    } finally {
      setHostLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    const arrival = new Date(data.expectedArrival);
    if (Number.isNaN(arrival.getTime())) {
      setSubmitError('Expected arrival is not a valid date and time.');
      return;
    }
    if (arrival.getTime() < Date.now() - 5 * 60 * 1000) {
      setSubmitError('Expected arrival is in the past. Choose a current or future time.');
      return;
    }
    try {
      const res = await api
        .post('visitors', {
          json: {
            tenantId: data.tenantId,
            visitorName: data.visitorName.trim(),
            visitorPhone: normalizeInPhone(data.visitorPhone),
            purpose: data.purpose.trim(),
            expectedArrival: arrival.toISOString(),
          },
        })
        .json<{ success: boolean; data?: { _id?: string } }>();
      const createdId = res.data?._id;
      router.push(createdId ? `/visitors/${createdId}` : '/visitors');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="Register Visitor"
      description="Pre-register a guest pass for a resident"
      backHref="/visitors"
      error={submitError}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/visitors"
            submitLabel="Register Visitor"
            divided={false}
          />
        }
      >
        <FormSection
          title="Host resident"
          icon={<UserRound />}
          description="Only active residents can receive visitors"
        >
          <Controller
            name="tenantId"
            control={control}
            render={({ field }) => (
              <ResourceSelect
                label="Tenant"
                endpoint="tenants?isActive=true"
                value={field.value}
                onChange={(val) => {
                  field.onChange(val);
                  void onTenantChange(val);
                }}
                placeholder="Select tenant..."
                error={err.tenantId?.message}
                valueKey="_id"
                labelKey={tenantLabel}
                dataPath="data"
              />
            )}
          />
          {tenantIdWatch ? (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
              {hostLoading ? (
                <p className="text-xs font-semibold text-[color:var(--color-brand-700)]">
                  Loading host stay…
                </p>
              ) : hostPreview ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-[color:var(--color-brand-800)]">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {hostPreview.name}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5" />
                    Room {hostPreview.roomNumber ?? 'N/A'}
                    {hostPreview.bedId ? ` · Bed ${hostPreview.bedId}` : ''}
                  </span>
                  {hostPreview.floorLabel && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {hostPreview.floorLabel}
                    </span>
                  )}
                  {hostPreview.bedId && (
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" />
                      Bed {hostPreview.bedId}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs font-semibold text-[color:var(--color-text-muted)]">
                  Select a tenant to preview their room and bed placement.
                </p>
              )}
            </div>
          ) : null}
        </FormSection>

        <FormSection
          title="Visit details"
          icon={<DoorOpen />}
          description="Who is visiting and why"
          divided
        >
          <FormGrid>
            <Input
              label="Visitor name"
              placeholder="Full name"
              error={err.visitorName?.message}
              leftIcon={<UserRound className="h-4 w-4" />}
              autoComplete="name"
              {...register('visitorName')}
            />
            <Input
              label="Visitor phone"
              placeholder="+919876543210"
              inputMode="tel"
              error={err.visitorPhone?.message}
              leftIcon={<Phone className="h-4 w-4" />}
              autoComplete="tel"
              {...register('visitorPhone')}
            />
          </FormGrid>
          <div className="mt-4 space-y-2">
            <Input
              label="Purpose"
              placeholder="e.g. Family Visit, Delivery"
              error={err.purpose?.message}
              leftIcon={<DoorOpen className="h-4 w-4" />}
              {...register('purpose')}
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common purposes">
              {PURPOSE_OPTIONS.map((option) => {
                const selected = (purposeWatch ?? '').trim().toLowerCase() === option.toLowerCase();
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setValue('purpose', option, { shouldValidate: true })}
                    className={
                      selected
                        ? 'rounded-full border border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)] px-3 py-1 text-xs font-bold text-white shadow-[var(--shadow-xs)]'
                        : 'rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-brand-300)] hover:text-[color:var(--color-text-primary)]'
                    }
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Schedule"
          icon={<CalendarDays />}
          description="When the guest is expected at the gate"
          divided
        >
          <FormGrid>
            <Input
              label="Expected arrival"
              type="datetime-local"
              error={err.expectedArrival?.message}
              leftIcon={<CalendarDays className="h-4 w-4" />}
              {...register('expectedArrival')}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
                Arrival summary
              </p>
              {summary ? (
                <div
                  className={
                    summary.isPast
                      ? 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] px-3 py-2 text-sm'
                      : 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm'
                  }
                >
                  {summary.isPast ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-danger-600)]" />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-brand-600)]" />
                  )}
                  <span>
                    <span className="font-bold text-[color:var(--color-text-primary)]">
                      {summary.label}
                    </span>
                    <span className="block text-xs font-medium text-[color:var(--color-text-secondary)]">
                      {summary.detail}
                    </span>
                  </span>
                </div>
              ) : (
                <p className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm text-[color:var(--color-text-secondary)]">
                  Pick a date and time to preview the visit window.
                </p>
              )}
            </div>
          </FormGrid>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
