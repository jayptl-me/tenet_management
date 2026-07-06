'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { toast } from 'sonner';

const enquiryUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'follow_up', 'converted', 'closed']),
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
  followUpDate?: string;
  referralDetails?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

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
        reset({
          status: (res.data.status as EnquiryUpdateForm['status']) ?? 'new',
        });
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
        .put(`enquiries/${params.id}`, { json: data })
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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="space-y-6">
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Enquiry not found'}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">
              Enquiry from {enquiry.name}
            </h2>
            <p className="text-surface-500 mt-0.5 text-sm">
              Received on{' '}
              {new Date(enquiry.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(enquiry.status)}
          label={enquiry.status.replace(/_/g, ' ')}
        />
      </div>

      {/* Main detail cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Enquiry details */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Enquiry Details
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Name
              </p>
              <p className="text-surface-900 mt-1 text-base font-semibold">{enquiry.name}</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Phone
              </p>
              <p className="text-surface-900 mt-1 text-base font-semibold">{enquiry.phone}</p>
            </div>
            {enquiry.email && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Email
                </p>
                <p className="text-surface-700 mt-1 text-sm">{enquiry.email}</p>
              </div>
            )}
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Source
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold capitalize">
                {enquiry.source}
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Status
              </p>
              <p className="mt-1">
                <StatusBadge
                  variant={statusToVariant(enquiry.status)}
                  label={enquiry.status.replace(/_/g, ' ')}
                />
              </p>
            </div>
            {enquiry.followUpDate && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Follow-up Date
                </p>
                <p className="text-surface-900 mt-1 text-sm font-semibold">
                  {new Date(enquiry.followUpDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {enquiry.message && (
            <div className="border-surface-200 mt-6 border-t-2 pt-4">
              <p className="text-surface-500 mb-2 text-xs font-semibold uppercase tracking-wider">
                Message
              </p>
              <p className="text-surface-700 whitespace-pre-wrap text-sm">{enquiry.message}</p>
            </div>
          )}
        </div>

        {/* Source and referral card */}
        <div className="bg-surface-50 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Source & Info
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Source
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold capitalize">
                {enquiry.source}
              </p>
            </div>
            {enquiry.referralDetails && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Referral Details
                </p>
                <p className="text-surface-700 mt-1 text-sm">{enquiry.referralDetails}</p>
              </div>
            )}
            {enquiry.notes && (
              <div className="border-surface-200 border-t-2 pt-3">
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Notes
                </p>
                <p className="text-surface-700 mt-1 whitespace-pre-wrap text-sm">{enquiry.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status update form */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">Update Status</h3>
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
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </div>

      {/* Meta */}
      {enquiry.updatedAt && (
        <p className="text-surface-400 text-right text-xs">
          Last updated: {new Date(enquiry.updatedAt).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}
