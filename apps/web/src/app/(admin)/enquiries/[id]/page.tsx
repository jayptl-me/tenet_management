'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, UserPlus, Phone, Mail, Tag, FileText, User } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { toast } from 'sonner';

const enquiryUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'lost']),
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
  createdAt: string;
  updatedAt?: string;
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
    defaultValues: { status: 'new' },
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
        reset({ status: (res.data.status as EnquiryUpdateForm['status']) ?? 'new' });
      } catch {
        setError('Failed to load enquiry details');
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
        setEnquiry((prev) => (prev ? { ...prev, status: data.status } : prev));
      } else {
        toast.error('Failed to update enquiry');
      }
    } catch {
      toast.error('Failed to update enquiry');
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

  return (
    <FormPage
      title={enquiry ? `Enquiry from ${enquiry.name}` : 'Enquiry Details'}
      description={
        enquiry
          ? `Received ${formatDate(enquiry.createdAt)} · ${enquiry.source}`
          : 'View enquiry information'
      }
      backHref="/enquiries"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        enquiry ? (
          <StatusBadge variant={statusVariant} label={enquiry.status.replace(/_/g, ' ')} />
        ) : undefined
      }
    >
      {enquiry && (
        <div className="space-y-6">
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <DetailCard title="Enquiry Details" icon={<User />} className="lg:col-span-2">
              <DetailList>
                <DetailRow label="Name" value={enquiry.name} />
                <DetailRow label="Phone" value={enquiry.phone} />
                {enquiry.email && (
                  <DetailRow
                    label="Email"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                        {enquiry.email}
                      </span>
                    }
                  />
                )}
                <DetailRow
                  label="Source"
                  value={<span className="capitalize">{enquiry.source}</span>}
                />
                <DetailRow
                  label="Status"
                  value={
                    <StatusBadge
                      variant={statusVariant}
                      label={enquiry.status.replace(/_/g, ' ')}
                    />
                  }
                />
                {enquiry.preferredSharing && (
                  <DetailRow
                    label="Preferred sharing"
                    value={
                      enquiry.preferredSharing === 'single'
                        ? 'Single'
                        : `${enquiry.preferredSharing} sharing`
                    }
                  />
                )}
              </DetailList>

              {enquiry.message && (
                <div className="mt-4 border-t border-[color:var(--border-color)] pt-4">
                  <p className="mb-2 text-xs font-medium text-[color:var(--color-text-muted)]">
                    Message
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                    {enquiry.message}
                  </p>
                </div>
              )}
            </DetailCard>

            <DetailCard title="Source & Info" icon={<Tag />}>
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
              </DetailList>
              {enquiry.notes && (
                <div className="mt-3 border-t border-[color:var(--border-color)] pt-3">
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)]">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--color-text-secondary)]">
                    {enquiry.notes}
                  </p>
                </div>
              )}
            </DetailCard>
          </div>

          <DetailCard title="Update Status" icon={<FileText />}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col items-end gap-4 sm:flex-row"
            >
              <div className="w-full flex-1 sm:max-w-xs">
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  error={errors.status?.message}
                  {...register('status')}
                />
              </div>
              <Button type="submit" disabled={isSaving} loading={isSaving}>
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </form>
          </DetailCard>

          <DetailCard title="Actions" icon={<UserPlus />}>
            <p className="mb-4 text-sm text-[color:var(--color-text-secondary)]">
              Convert this enquiry into a tenant. This will pre-fill the new tenant form with the
              enquirer details.
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
