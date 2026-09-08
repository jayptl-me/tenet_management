'use client';

import { useState, useEffect } from 'react';
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
  BedDouble,
  Building2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { normalizeInPhone, isValidInPhone } from '@/lib/phone';
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

interface HostInfo {
  id: string;
  name: string;
  phone?: string;
  roomNumber?: string;
  bedId?: string;
  floorLabel?: string;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
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

export default function EditVisitorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [host, setHost] = useState<HostInfo | null>(null);
  const [originalArrival, setOriginalArrival] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const purposeWatch = useWatch({ control, name: 'purpose' });
  const arrivalWatch = useWatch({ control, name: 'expectedArrival' });
  const summary = arrivalSummary(arrivalWatch ?? '');
  const changed = Boolean(originalArrival && arrivalWatch && originalArrival !== arrivalWatch);

  useEffect(() => {
    if (!id) return;
    api
      .get(`visitors/${id}`)
      .json<{
        success: boolean;
        data: {
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
            room?: { roomNumber?: string; floor?: { label?: string } };
          };
        };
      }>()
      .then((res) => {
        const d = res.data;
        const arrivalRaw = d.expectedArrival ?? '';
        let expectedArrival = '';
        if (arrivalRaw) {
          const dt = new Date(arrivalRaw);
          if (!Number.isNaN(dt.getTime())) {
            // datetime-local wants local YYYY-MM-DDTHH:mm
            const pad = (n: number) => String(n).padStart(2, '0');
            expectedArrival = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
          }
        }
        setCurrentStatus(typeof d.status === 'string' ? d.status : '');
        setOriginalArrival(expectedArrival);
        const t = d.tenant;
        if (t?._id) {
          setHost({
            id: t._id,
            name: t.user?.name ?? 'Unknown',
            phone: t.user?.phone,
            roomNumber: t.room?.roomNumber,
            bedId: t.bedId,
            floorLabel: t.room?.floor?.label,
          });
        }
        reset({
          visitorName: d.visitorName ?? d.name ?? '',
          visitorPhone: d.visitorPhone ?? d.phone ?? '',
          purpose: d.purpose ?? '',
          expectedArrival,
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
      // Status is intentionally omitted — lifecycle (arrive/depart/cancel) is FSM-driven
      // via dedicated actions on the visitor detail page.
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
      router.push(`/visitors/${id}`);
    } catch (err) {
      setSubmitError((await parseApiError(err)).message);
    }
  };

  const err = errors as Record<string, { message?: string }>;
  const statusLabel = currentStatus
    ? currentStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';

  return (
    <FormPage
      title="Edit Visitor"
      description="Update visitor metadata. Use Arrive / Depart on the detail page for status."
      backHref={`/visitors/${id}`}
      error={submitError}
      isLoading={isLoading}
      maxWidth="3xl"
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
          {host ? (
            <div className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <Link
                  href={`/tenants/${host.id}`}
                  className="inline-flex items-center gap-1 font-bold text-[color:var(--color-brand-600)] underline-offset-2 hover:underline"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  {host.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-text-secondary)]">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Room {host.roomNumber ?? 'N/A'}
                  {host.bedId ? ` · Bed ${host.bedId}` : ''}
                </span>
                {host.floorLabel && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-text-secondary)]">
                    <Building2 className="h-3.5 w-3.5" />
                    {host.floorLabel}
                  </span>
                )}
                {host.bedId && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-text-secondary)]">
                    <BedDouble className="h-3.5 w-3.5" />
                    Bed {host.bedId}
                  </span>
                )}
              </div>
              {host.phone && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-text-muted)]">
                  <Phone className="h-3 w-3" />
                  {host.phone}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium text-[color:var(--color-text-muted)]">
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
              <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
                Arrival summary
              </p>
              {summary ? (
                <div
                  className={
                    summary.isPast
                      ? 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-warning-300)] bg-[color:var(--color-warning-50)] px-3 py-2 text-sm'
                      : 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm'
                  }
                >
                  {summary.isPast ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-warning-600)]" />
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
                    {changed && (
                      <span className="mt-1 block text-xs font-semibold text-[color:var(--color-brand-700)]">
                        Previously {formatDateTime(originalArrival)}
                      </span>
                    )}
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

        <FormSection
          title="Status"
          description="Lifecycle state is managed on the detail page"
          divided
        >
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
              Current status
            </p>
            <p className="rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-2 text-sm font-bold text-[color:var(--color-text-secondary)]">
              {statusLabel}
            </p>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Use Arrive / Depart / Cancel on the visitor detail page. Status cannot be set freely
              here.
            </p>
          </div>
        </FormSection>
      </FormCard>
    </FormPage>
  );
}
