'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Save,
  UserPlus,
  Phone,
  Mail,
  Tag,
  FileText,
  User,
  Pencil,
  MessageSquareMore,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { toast } from 'sonner';

const enquiryUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'lost']),
  notes: z.string().max(1000).optional(),
});

type EnquiryUpdateForm = z.infer<typeof enquiryUpdateSchema>;

interface EnquiryDetail {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  status: string;
  source: string;
  preferredSharing?: string;
  notes?: string;
  convertedTenantId?:
    | string
    | {
        _id?: string;
        bedId?: string | null;
        user?: { name?: string };
        room?: { roomNumber?: string };
      }
    | null;
  createdAt: string;
  updatedAt?: string;
}

function convertedTenantRef(enquiry: EnquiryDetail): { id: string; label: string } | null {
  const c = enquiry.convertedTenantId;
  if (!c) return null;
  if (typeof c === 'string') return { id: c, label: 'View tenant profile' };
  const id = c._id ? String(c._id) : '';
  if (!id) return null;
  const parts = [c.user?.name ?? 'Tenant'];
  if (c.room?.roomNumber) parts.push(`Room ${c.room.roomNumber}`);
  if (c.bedId) parts.push(`Bed ${c.bedId}`);
  return { id, label: parts.join(' · ') };
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN');
  } catch {
    return '—';
  }
}

export default function EnquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [enquiry, setEnquiry] = useState<EnquiryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EnquiryUpdateForm>({
    resolver: zodResolver(enquiryUpdateSchema),
    defaultValues: { status: 'new', notes: '' },
  });

  useEffect(() => {
    async function fetchEnquiry() {
      setIsLoading(true);
      setError('');
      try {
        const res = await api
          .get(`enquiries/${params.id}`)
          .json<{ success: boolean; data: EnquiryDetail }>();
        setEnquiry(res.data);
        reset({
          status: (res.data.status as EnquiryUpdateForm['status']) ?? 'new',
          notes: res.data.notes ?? '',
        });
      } catch (err) {
        setError((await parseApiError(err)).message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEnquiry();
  }, [params.id, reset]);

  const onSubmit = async (data: EnquiryUpdateForm) => {
    setIsSaving(true);
    try {
      const res = await api
        .put(`enquiries/${params.id}/status`, { json: data })
        .json<{ success: boolean }>();
      if (res.success) {
        toast.success('Enquiry updated successfully');
        setEnquiry((prev) => (prev ? { ...prev, status: data.status, notes: data.notes } : prev));
      } else {
        toast.error('Failed to update enquiry');
      }
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoading && (error || !enquiry)) {
    return (
      <FormPage
        title="Enquiry Details"
        description="View enquiry information"
        backHref="/enquiries"
        error={error || 'Enquiry not found'}
        maxWidth="4xl"
      />
    );
  }

  const statusVariant = enquiry ? statusToVariant(enquiry.status) : 'neutral';
  const cleanPhoneDigits = enquiry ? enquiry.phone.replace(/\D/g, '') : '';

  return (
    <FormPage
      title={enquiry ? `Enquiry from ${enquiry.name}` : 'Enquiry Details'}
      description={
        enquiry
          ? `Received ${formatDate(enquiry.createdAt)} · ${enquiry.source.replace(/_/g, ' ')}`
          : 'View enquiry information'
      }
      backHref="/enquiries"
      isLoading={isLoading}
      maxWidth="4xl"
      actions={
        enquiry ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/enquiries/${enquiry._id}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit Enquiry
            </Button>
          </div>
        ) : undefined
      }
      badge={
        enquiry ? (
          <StatusBadge variant={statusVariant} label={enquiry.status.replace(/_/g, ' ')} />
        ) : undefined
      }
    >
      {enquiry && (
        <div className="space-y-6">
          {/* ── Stat Cards ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Phone"
              value={enquiry.phone}
              icon={<Phone className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Source"
              value={enquiry.source.replace(/_/g, ' ')}
              icon={<Tag className="h-4 w-4" />}
              variant="brand"
            />
            <StatCard
              title="Status"
              value={enquiry.status.replace(/_/g, ' ')}
              icon={<FileText className="h-4 w-4" />}
              variant={
                statusVariant === 'success'
                  ? 'success'
                  : statusVariant === 'warning'
                    ? 'warning'
                    : 'default'
              }
            />
          </div>

          {/* ── Quick Communication Actions ───────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-sm">
            <span className="text-xs font-semibold tracking-wider text-[color:var(--color-text-muted)] uppercase">
              Quick Outreach:
            </span>
            <a href={`tel:${enquiry.phone}`}>
              <Button variant="outline" size="sm">
                <Phone className="h-3.5 w-3.5 text-[color:var(--color-brand-600)]" />
                Call ({enquiry.phone})
              </Button>
            </a>
            <a href={`https://wa.me/${cleanPhoneDigits}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <MessageSquareMore className="h-3.5 w-3.5 text-emerald-600" />
                WhatsApp Message
              </Button>
            </a>
            {enquiry.email && (
              <a href={`mailto:${enquiry.email}`}>
                <Button variant="outline" size="sm">
                  <Mail className="h-3.5 w-3.5 text-[color:var(--color-text-secondary)]" />
                  Email ({enquiry.email})
                </Button>
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <DetailCard title="Enquiry Details" icon={<User />} className="lg:col-span-2">
              <DetailList>
                <DetailRow label="Name" value={enquiry.name} />
                <DetailRow
                  label="Phone"
                  value={
                    <a
                      href={`tel:${enquiry.phone}`}
                      className="text-[color:var(--color-brand-600)] hover:underline"
                    >
                      {enquiry.phone}
                    </a>
                  }
                />
                {enquiry.email && (
                  <DetailRow
                    label="Email"
                    value={
                      <a
                        href={`mailto:${enquiry.email}`}
                        className="inline-flex items-center gap-1 text-[color:var(--color-text-secondary)] hover:underline"
                      >
                        <Mail className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                        {enquiry.email}
                      </a>
                    }
                  />
                )}
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusVariant}
                      label={enquiry.status.replace(/_/g, ' ')}
                    />
                  }
                />
              </DetailList>

              {enquiry.message && (
                <div className="mt-4 border-t border-[color:var(--border-color)] pt-4">
                  <p className="mb-2 text-xs font-medium text-[color:var(--color-text-muted)]">
                    Message
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
                    {enquiry.message}
                  </p>
                </div>
              )}
            </DetailCard>

            <DetailCard title="Source & Follow-up Info" icon={<Tag />}>
              <DetailList>
                <DetailRow
                  label="Source"
                  value={<span className="capitalize">{enquiry.source.replace(/_/g, ' ')}</span>}
                />
                {enquiry.preferredSharing && (
                  <DetailRow
                    label="Sharing"
                    value={
                      enquiry.preferredSharing === 'single'
                        ? 'Single'
                        : `${enquiry.preferredSharing}-share`
                    }
                  />
                )}
                <DetailRow label="Received Date" value={formatDate(enquiry.createdAt)} />
              </DetailList>
              {enquiry.notes && (
                <div className="mt-3 border-t border-[color:var(--border-color)] pt-3">
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                    Staff Notes
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
                    {enquiry.notes}
                  </p>
                </div>
              )}
            </DetailCard>
          </div>

          {/* ── Status & Follow-up Notes Update ───────────────────── */}
          <DetailCard title="Update Pipeline Status & Staff Notes" icon={<FileText />}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Select
                    label="Status"
                    options={
                      enquiry.convertedTenantId
                        ? STATUS_OPTIONS
                        : STATUS_OPTIONS.filter((o) => o.value !== 'converted')
                    }
                    error={errors.status?.message}
                    disabled={enquiry.status === 'converted'}
                    helperText={
                      enquiry.status === 'converted'
                        ? 'Pinned to the converted tenant'
                        : !enquiry.convertedTenantId
                          ? 'Converted is set via Convert to Tenant below'
                          : undefined
                    }
                    {...register('status')}
                  />
                </div>
              </div>
              <div>
                <Textarea
                  label="Staff Follow-up Notes"
                  placeholder="Record viewing feedback, discussion notes, or next steps..."
                  rows={3}
                  error={errors.notes?.message}
                  {...register('notes')}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving} loading={isSaving}>
                  <Save className="h-4 w-4" />
                  Save Status & Notes
                </Button>
              </div>
            </form>
          </DetailCard>

          {/* ── Tenant Conversion Actions ─────────────────────────── */}
          <DetailCard title="Tenant Conversion" icon={<UserPlus />}>
            {enquiry.status === 'converted' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                  This lead has been successfully converted into an active PG tenant.
                </div>
                {(() => {
                  const converted = convertedTenantRef(enquiry);
                  return converted ? (
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/tenants/${converted.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {converted.label}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/tenants?search=${encodeURIComponent(enquiry.name)}`)
                      }
                    >
                      <ExternalLink className="h-4 w-4" />
                      Find Tenant Profile
                    </Button>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[color:var(--color-text-secondary)]">
                  Convert this enquiry into an active tenant. This pre-fills the tenant onboarding
                  form with the prospect contact details, opens room and bed selection, and records
                  the booking.
                </p>
                <Button
                  variant="primary"
                  onClick={() =>
                    router.push(
                      `/tenants/new?name=${encodeURIComponent(enquiry.name)}&phone=${encodeURIComponent(enquiry.phone)}&email=${encodeURIComponent(enquiry.email || '')}&source=enquiry&enquiryId=${enquiry._id}`,
                    )
                  }
                >
                  <UserPlus className="h-4 w-4" />
                  Convert to Tenant
                </Button>
              </div>
            )}
          </DetailCard>

          {enquiry.updatedAt && (
            <p className="text-right text-xs font-semibold text-[color:var(--color-text-muted)]">
              Last updated: {formatDateTime(enquiry.updatedAt)}
            </p>
          )}
        </div>
      )}
    </FormPage>
  );
}
