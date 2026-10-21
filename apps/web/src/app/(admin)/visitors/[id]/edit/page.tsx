'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Phone,
  UserRound,
  DoorOpen,
  CalendarDays,
  Clock,
  Building2,
  ExternalLink,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { FormPage } from '@/components/ui/FormPage';
import { FormCard } from '@/components/ui/FormCard';
import { FormActions } from '@/components/ui/FormActions';
import { FormSection, FormGrid } from '@/components/ui/FormSection';

const PURPOSE_OPTIONS = [
  'Family Visit',
  'Friend Visit',
  'Delivery',
  'Maintenance',
  'Interview',
  'Official Work',
];

const schema = z.object({
  visitorName: z.string().min(2, 'Visitor name must be at least 2 characters').max(100),
  visitorPhone: z
    .string()
    .min(10, 'Phone is required')
    .refine((v) => isValidInPhone(v), 'Must be a valid Indian mobile (+91...)'),
  purpose: z.string().min(1, 'Purpose is required').max(200),
  expectedArrival: z.string().min(1, 'Expected arrival is required'),
});

type FormData = z.infer<typeof schema>;

interface VisitorRecord {
  _id: string;
  status?: string;
  visitorName?: string;
  name?: string;
  visitorPhone?: string;
  phone?: string;
  purpose?: string;
  expectedArrival?: string;
  tenant?: {
    _id?: string;
    bedId?: string;
    user?: { name?: string; phone?: string };
    room?: { _id?: string; roomNumber?: string; floor?: { label?: string } };
  };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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

/** datetime-local wants the local time as YYYY-MM-DDTHH:mm. */
function toLocalInputValue(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export default function EditVisitorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState('');

  /**
   * The record, read through the shared query stack.
   */
  const {
    data: fetchedVisitor,
    isPending,
    error: queryError,
  } = useApiQuery<VisitorRecord>(
    ['visitors', 'detail', id],
    `visitors/${id}`,
    // A background refetch must not wipe what the operator is typing.
    { enabled: Boolean(id), refetchOnWindowFocus: false },
  );

  // The server answers with one record. Anything else is not a pass.
  const visitor = fetchedVisitor && !Array.isArray(fetchedVisitor) ? fetchedVisitor : null;
  const isLoading = isPending;

  /**
   * The values the form starts from.
   *
   * They are read out of the record and handed to the form as its values, so
   * the form is filled by the record itself and not by an effect that copies
   * it into state.
   */
  const formValues = useMemo<FormData | undefined>(() => {
    if (!visitor) return undefined;
    return {
      visitorName: visitor.visitorName ?? visitor.name ?? '',
      visitorPhone: visitor.visitorPhone ?? visitor.phone ?? '',
      purpose: visitor.purpose ?? '',
      expectedArrival: toLocalInputValue(visitor.expectedArrival),
    };
  }, [visitor]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: formValues,
  });

  const purposeWatch = useWatch({ control, name: 'purpose' });
  const arrivalWatch = useWatch({ control, name: 'expectedArrival' });
  const summary = arrivalSummary(arrivalWatch ?? '');
  // The hour the record holds, next to the hour in the form.
  const originalArrival = toLocalInputValue(visitor?.expectedArrival);
  const changed = Boolean(originalArrival && arrivalWatch && originalArrival !== arrivalWatch);

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      // Status is intentionally omitted - the lifecycle (arrive, depart,
      // cancel, approve) is FSM driven on the detail page.
      await api
        .put(`visitors/${id}`, {
          json: {
            visitorName: data.visitorName.trim(),
            visitorPhone: normalizeInPhone(data.visitorPhone),
            purpose: data.purpose.trim(),
            expectedArrival: new Date(data.expectedArrival).toISOString(),
          },
        })
        .json();
      // The record the operator lands on is the record the server holds.
      queryClient.invalidateQueries({ queryKey: ['visitors', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['visitors', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['visitors', 'count'] });
      router.push(`/visitors/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const statusLabel = visitor?.status
    ? visitor.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';

  if (!isLoading && !visitor) {
    return (
      <FormPage
        title="Edit Visitor"
        description="Update the details of a visitor pass"
        backHref={`/visitors/${id}`}
        error={errorMessage(queryError) || 'The server reports no visitor pass for this id.'}
        maxWidth="form"
      />
    );
  }

  return (
    <FormPage
      title="Edit Visitor"
      description="Update the details of a visitor pass. Use Arrive / Depart on the detail page for status."
      backHref={`/visitors/${id}`}
      error={submitError}
      isLoading={isLoading}
      maxWidth="form"
    >
      <FormCard
        onSubmit={handleSubmit(onSubmit)}
        footer={
          <FormActions
            loading={isSubmitting}
            cancelHref={`/visitors/${id}`}
            submitLabel="Save Changes"
            divided={false}
          />
        }
      >
        <FormSection
          title="Host resident"
          icon={<UserRound />}
          description="This visit is pinned to the resident below and cannot be reassigned here"
        >
          {visitor?.tenant?._id ? (
            <div className="rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50) p-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <Link
                  href={`/tenants/${visitor.tenant._id}`}
                  className="inline-flex items-center gap-1 font-bold text-(--color-brand-600) underline-offset-2 hover:underline"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  {visitor.tenant.user?.name ?? 'Unknown'}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <span className="inline-flex items-center gap-1 font-semibold text-(--color-text-secondary)">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Room {visitor.tenant.room?.roomNumber ?? 'N/A'}
                  {visitor.tenant.bedId ? ` · Bed ${visitor.tenant.bedId}` : ''}
                </span>
                {visitor.tenant.room?.floor?.label && (
                  <span className="inline-flex items-center gap-1 font-semibold text-(--color-text-secondary)">
                    <Building2 className="h-3.5 w-3.5" />
                    {visitor.tenant.room.floor.label}
                  </span>
                )}
              </div>
              {visitor.tenant.user?.phone && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-(--color-text-muted)">
                  <Phone className="h-3 w-3" />
                  {visitor.tenant.user.phone}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium text-(--color-text-muted)">
              Host resident details unavailable.
            </p>
          )}
        </FormSection>

        <FormSection
          title="Visit details"
          icon={<DoorOpen />}
          description="Who is visiting and why"
          divided
        >
          <FormGrid>
            <Input
              label="Full name"
              placeholder="Visitor name"
              error={err.visitorName?.message}
              leftIcon={<UserRound className="h-4 w-4" />}
              autoComplete="name"
              {...register('visitorName')}
            />
            <Input
              label="Phone number"
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
              label="Purpose of visit"
              placeholder="e.g. Guest visit, delivery, maintenance"
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
                        ? 'rounded-full border border-(--color-brand-500) bg-(--color-brand-500) px-3 py-1 text-xs font-bold text-(--color-on-brand) shadow-(--shadow-xs)'
                        : 'rounded-full border border-(--border-color) bg-(--color-field-bg) px-3 py-1 text-xs font-semibold text-(--color-text-secondary) hover:border-(--color-brand-300) hover:text-(--color-text-primary)'
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
          description="Reschedule the expected arrival"
          divided
        >
          <FormGrid>
            <Input
              label="Expected arrival"
              type="datetime-local"
              error={err.expectedArrival?.message}
              {...register('expectedArrival')}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-(--color-text-primary)">Arrival summary</p>
              {summary ? (
                <div
                  className={
                    summary.isPast
                      ? 'flex items-start gap-2 rounded-(--radius-md) border border-(--color-warning-300) bg-(--color-warning-50) px-3 py-2 text-sm'
                      : 'flex items-start gap-2 rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50) px-3 py-2 text-sm'
                  }
                >
                  {summary.isPast ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--color-danger-600)" />
                  ) : (
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-(--color-brand-600)" />
                  )}
                  <span>
                    <span className="font-bold text-(--color-text-primary)">{summary.label}</span>
                    <span className="block text-xs font-medium text-(--color-text-secondary)">
                      {summary.detail}
                    </span>
                    {changed && (
                      <span className="mt-1 block text-xs font-semibold text-(--color-brand-700)">
                        Previously {formatDateTime(originalArrival)}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <p className="rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50) px-3 py-2 text-sm text-(--color-text-secondary)">
                  Pick a date and time to preview the visit window.
                </p>
              )}
            </div>
          </FormGrid>
        </FormSection>

        <FormSection
          title="Status"
          description="Lifecycle state is managed on the detail page"
          divided
        >
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-(--color-text-primary)">Current status</p>
            <p className="rounded-(--radius-md) border border-(--border-color) bg-(--color-surface-50) px-3 py-2 text-sm font-bold text-(--color-text-secondary)">
              {statusLabel}
            </p>
            <p className="text-xs text-(--color-text-muted)">
              Use Arrive / Depart / Cancel on the visitor detail page. Status cannot be set freely
              here.
            </p>
          </div>
        </FormSection>

        <FormSection
          title="What this save commits"
          icon={<FileText />}
          description="What the server writes, and what the resident hears"
          divided
        >
          <ul className="space-y-2 text-xs font-medium text-(--color-text-secondary)">
            <li>
              <strong className="text-(--color-text-primary)">The details of the pass.</strong> The
              server writes the name, the phone, the purpose and the expected hour, and writes an
              update entry in the audit log with the fields that moved. It refuses a name under two
              characters and a phone that is not an Indian mobile in the +91 form.
            </li>
            <li>
              <strong className="text-(--color-text-primary)">
                The state of the pass does not move.
              </strong>{' '}
              The save cannot change the state: the gate does that with Arrive, Depart, Cancel and
              Re-approve, and the server refuses every other way in. The resident this visit is
              pinned to cannot be changed here either.
            </li>
            <li>
              <strong className="text-(--color-text-primary)">The resident is not told.</strong> A
              changed hour, a changed name or a changed purpose sends no message. The resident sees
              the new details the next time they open the app, and the gate tells them at the desk.
            </li>
          </ul>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
