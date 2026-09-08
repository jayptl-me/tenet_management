'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserRound,
  DoorOpen,
  CalendarDays,
  FileText,
  Clock,
  Building2,
  BedDouble,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Textarea';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';
import { tenantLabel } from '@/lib/resource-select-presets';

const REASON_TEMPLATES = [
  'Family Function',
  'Medical',
  'Travel',
  'Emergency',
  'Festival',
  'Personal Work',
];

const schema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  fromDate: z
    .string()
    .min(1, 'From date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  toDate: z
    .string()
    .min(1, 'To date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

type FormData = z.infer<typeof schema>;

interface TenantPreview {
  name: string;
  roomNumber?: string;
  bedId?: string;
  floorLabel?: string;
}

function inclusiveDays(from: string, to: string): number | null {
  if (!from || !to) return null;
  const s = new Date(`${from}T00:00:00.000Z`);
  const e = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

function periodSummary(from: string, to: string): string {
  const n = inclusiveDays(from, to);
  if (n == null) return 'Pick both dates to preview the leave window.';
  if (n <= 0) return 'From date is after To date. Swap the dates to continue.';
  const today = new Date().toISOString().slice(0, 10);
  const span = `${n} day${n === 1 ? '' : 's'} inclusive`;
  if (to < today) return `${span} · entirely in the past (backdated)`;
  if (from > today) return `${span} · upcoming`;
  return `${span} · includes today`;
}

export default function NewLeavePage() {
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
  const fromWatch = useWatch({ control, name: 'fromDate' });
  const toWatch = useWatch({ control, name: 'toDate' });
  const reasonWatch = useWatch({ control, name: 'reason' });
  const days = inclusiveDays(fromWatch ?? '', toWatch ?? '');
  const rangeInvalid = days != null && days <= 0;

  const onTenantChange = async (tenantId: string) => {
    setValue('tenantId', tenantId);
    setHostPreview(null);
    if (!tenantId) return;
    setHostLoading(true);
    try {
      const res = await api.get(`tenants/${tenantId}`).json<{
        success: boolean;
        data: {
          user?: { name?: string };
          room?: { roomNumber?: string; floor?: { label?: string } };
          bedId?: string;
        };
      }>();
      const d = res.data;
      setHostPreview({
        name: d.user?.name ?? 'Unknown',
        roomNumber: d.room?.roomNumber,
        bedId: d.bedId,
        floorLabel: d.room?.floor?.label,
      });
    } catch {
      setHostPreview(null);
    } finally {
      setHostLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    if (data.fromDate > data.toDate) {
      setSubmitError('From date must be on or before To date.');
      return;
    }
    try {
      const res = await api
        .post('leaves', { json: data })
        .json<{ success: boolean; data?: { _id?: string } }>();
      const createdId = res.data?._id;
      router.push(createdId ? `/leaves/${createdId}` : '/leaves');
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;

  return (
    <FormPage
      title="New Leave Application"
      description="Record a tenant absence; approval syncs the attendance board"
      backHref="/leaves"
      error={submitError}
      maxWidth="3xl"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref="/leaves"
            submitLabel="Save Leave"
            divided={false}
          />
        }
      >
        <FormSection
          title="Applicant"
          icon={<UserRound />}
          description="Only active residents can hold leave applications"
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
          title="Period"
          icon={<CalendarDays />}
          description="Inclusive absence window in YYYY-MM-DD"
          divided
        >
          <FormGrid>
            <DatePicker
              label="From date"
              error={err.fromDate?.message}
              leftIcon={<CalendarDays className="h-4 w-4" />}
              {...register('fromDate')}
            />
            <DatePicker
              label="To date"
              error={err.toDate?.message}
              leftIcon={<CalendarDays className="h-4 w-4" />}
              {...register('toDate')}
            />
          </FormGrid>
          <div
            className={
              rangeInvalid
                ? 'mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] px-3 py-2 text-sm'
                : 'mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm'
            }
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-brand-600)]" />
            <span className="text-xs font-semibold text-[color:var(--color-text-secondary)]">
              {periodSummary(fromWatch ?? '', toWatch ?? '')}
            </span>
          </div>
        </FormSection>

        <FormSection
          title="Reason"
          icon={<FileText />}
          description="Visible to the resident on their portal"
          divided
        >
          <Textarea
            label="Reason for leave"
            rows={4}
            placeholder="Reason for leave..."
            error={err.reason?.message}
            maxLength={500}
            {...register('reason')}
          />
          <div className="mt-1 flex items-center justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common reasons">
              {REASON_TEMPLATES.map((option) => {
                const selected = (reasonWatch ?? '').trim().toLowerCase() === option.toLowerCase();
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setValue('reason', option, { shouldValidate: true })}
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
            <p className="shrink-0 text-[11px] font-medium text-[color:var(--color-text-muted)]">
              {(reasonWatch ?? '').length}/500
            </p>
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
