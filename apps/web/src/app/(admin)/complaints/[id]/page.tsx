'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Save,
  AlertCircle,
  User,
  FileText,
  Pencil,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { QuickResolveModal } from '@/components/admin/QuickResolveModal';
import { toast } from 'sonner';

const complaintUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
  adminNotes: z.string().max(2000, 'Notes must be under 2000 characters').optional(),
});

type ComplaintUpdateForm = z.infer<typeof complaintUpdateSchema>;

interface ComplaintDetail {
  _id: string;
  tenant?: {
    _id: string;
    bedId?: string | null;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string; floor?: { label?: string } | null };
  };
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  adminNotes?: string;
  photos?: string[];
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

// Detail key for this record; the complaints list and stats live under the same
// `['complaints']` prefix, so one invalidation re-reads every complaint view.
const COMPLAINT_KEY = (id: string) => ['complaints', id] as const;
const COMPLAINTS_PREFIX = ['complaints'] as const;

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN');
  } catch {
    return d;
  }
}

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;
  const [isSaving, setIsSaving] = useState(false);
  const [quickResolveOpen, setQuickResolveOpen] = useState(false);
  // Outcome of the last write, as reported by the server.
  const [writeResult, setWriteResult] = useState('');

  const {
    data: complaint = null,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<ComplaintDetail>(COMPLAINT_KEY(id), `complaints/${id}`, { enabled: !!id });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ComplaintUpdateForm>({
    resolver: zodResolver(complaintUpdateSchema),
    defaultValues: { status: 'open', adminNotes: '' },
  });

  /**
   * Re-read the complaint from the server. The screen then renders the server
   * state (status badge, notes, timestamps) instead of a locally asserted
   * outcome. The prefix covers this record's detail key (`['complaints', id]`)
   * and the list and stats keys, so every complaint view re-reads the server.
   */
  const refreshAfterMutation = async () => {
    await queryClient.invalidateQueries({ queryKey: COMPLAINTS_PREFIX });
  };

  const handleQuickResolve = async (
    id: string,
    status: 'resolved' | 'dismissed',
    adminNotes: string,
  ) => {
    try {
      const res = await api
        .put(`complaints/${id}/status`, {
          json: { status, adminNotes },
        })
        .json<{ success: boolean; data?: { status?: string; adminNotes?: string } }>();
      setQuickResolveOpen(false);
      await refreshAfterMutation();
      const serverStatus = res.data?.status ?? status;
      setWriteResult(
        `Status saved. The server now reports this complaint as "${serverStatus.replace(/_/g, ' ')}".`,
      );
      reset({
        status: serverStatus as ComplaintUpdateForm['status'],
        adminNotes: res.data?.adminNotes ?? adminNotes,
      });
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    }
  };

  // Seed the form from the server's record, once per record.
  const seededId = useRef<string | null>(null);
  useEffect(() => {
    if (!complaint) return;
    if (seededId.current === complaint._id) return;
    seededId.current = complaint._id;
    reset({
      status: (complaint.status as ComplaintUpdateForm['status']) ?? 'open',
      adminNotes: complaint.adminNotes ?? '',
    });
  }, [complaint, reset]);

  const onSubmit = async (data: ComplaintUpdateForm) => {
    setIsSaving(true);
    try {
      const res = await api
        .put(`complaints/${id}`, { json: data })
        .json<{ success: boolean; data?: { status?: string; adminNotes?: string } }>();
      if (res.success) {
        await refreshAfterMutation();
        const serverStatus = res.data?.status ?? data.status;
        setWriteResult(
          `Update saved. The server now reports this complaint as "${serverStatus.replace(/_/g, ' ')}".`,
        );
        reset({
          status: serverStatus as ComplaintUpdateForm['status'],
          adminNotes: res.data?.adminNotes ?? data.adminNotes ?? '',
        });
      } else {
        toast.error('Failed to update complaint');
      }
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoading && (errorMessage(queryError) || !complaint)) {
    return (
      <FormPage
        title="Complaint Details"
        description="View complaint information"
        backHref="/complaints"
        error={errorMessage(queryError) || 'Complaint not found'}
        maxWidth="full"
      />
    );
  }

  const priorityVariant = complaint ? statusToVariant(complaint.priority) : 'info';
  const statusVariant = complaint ? statusToVariant(complaint.status) : 'neutral';

  return (
    <>
      <FormPage
        title={complaint?.title ?? 'Complaint Details'}
        description={
          complaint
            ? `Reported on ${formatDate(complaint.createdAt)}`
            : 'View complaint information'
        }
        backHref="/complaints"
        isLoading={isLoading}
        maxWidth="full"
        badge={
          complaint ? (
            <StatusBadge variant={statusVariant} label={complaint.status.replace(/_/g, ' ')} />
          ) : undefined
        }
        actions={
          complaint ? (
            <div className="flex items-center gap-2">
              {(complaint.status === 'open' || complaint.status === 'in_progress') && (
                <Button variant="primary" size="sm" onClick={() => setQuickResolveOpen(true)}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Quick Resolve
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/complaints/${complaint._id}/edit`)}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
            </div>
          ) : undefined
        }
      >
        {complaint && (
          <div className="space-y-6">
            {writeResult && (
              <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
                {writeResult}
              </div>
            )}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <DetailCard
                title="Complaint Details"
                icon={<AlertCircle />}
                className="lg:col-span-2"
              >
                <DetailList>
                  <DetailRow
                    label="Category"
                    value={
                      <span className="capitalize">{complaint.category.replace(/_/g, ' ')}</span>
                    }
                  />
                  <DetailRow
                    label="Severity"
                    value={<StatusBadge variant={priorityVariant} label={complaint.priority} />}
                  />
                  <DetailRow
                    label="Status"
                    value={
                      <StatusBadge
                        variant={statusVariant}
                        label={complaint.status.replace(/_/g, ' ')}
                      />
                    }
                  />
                  {complaint.resolvedAt && (
                    <DetailRow label="Resolved at" value={formatDateTime(complaint.resolvedAt)} />
                  )}
                </DetailList>

                <div className="mt-4 border-t border-(--border-color) pt-4">
                  <p className="mb-2 text-xs font-medium text-(--color-text-muted)">Description</p>
                  <p className="text-sm font-medium whitespace-pre-wrap text-(--color-text-secondary)">
                    {complaint.description}
                  </p>
                </div>

                {complaint.photos && complaint.photos.length > 0 ? (
                  <div className="mt-4 border-t border-(--border-color) pt-4">
                    <p className="mb-2 text-xs font-medium text-(--color-text-muted)">
                      Photos ({complaint.photos.length})
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {complaint.photos.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block h-24 w-24 overflow-hidden rounded-(--radius-md) border border-(--border-color) shadow-xs transition-transform hover:scale-105"
                        >
                          <Image
                            src={url}
                            alt="Complaint evidence"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <ExternalLink className="h-4 w-4 text-white" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {complaint.adminNotes ? (
                  <div className="mt-4 rounded-(--radius-lg) border border-(--border-color) bg-(--color-surface-50) p-4">
                    <p className="text-2xs mb-1 font-bold tracking-wider text-(--color-text-muted) uppercase">
                      Admin notes
                    </p>
                    <p className="text-sm font-medium whitespace-pre-wrap text-(--color-text-secondary)">
                      {complaint.adminNotes}
                    </p>
                  </div>
                ) : null}
              </DetailCard>

              <DetailCard title="Reported By" icon={<User />}>
                <DetailList>
                  <DetailRow
                    label="Name"
                    value={
                      complaint.tenant?._id ? (
                        <Link
                          href={`/tenants/${complaint.tenant._id}`}
                          className="inline-flex items-center gap-1 font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {complaint.tenant?.user?.name ?? 'View Tenant'}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        (complaint.tenant?.user?.name ?? 'N/A')
                      )
                    }
                  />
                  <DetailRow label="Room" value={complaint.tenant?.room?.roomNumber ?? 'N/A'} />
                  {complaint.tenant?.bedId && (
                    <DetailRow label="Bed" value={complaint.tenant.bedId} />
                  )}
                  {complaint.tenant?.room?.floor?.label && (
                    <DetailRow label="Floor" value={complaint.tenant.room.floor.label} />
                  )}
                  {complaint.tenant?.user?.email && (
                    <DetailRow label="Email" value={complaint.tenant.user.email} />
                  )}
                  {complaint.tenant?.user?.phone && (
                    <DetailRow label="Phone" value={complaint.tenant.user.phone} />
                  )}
                </DetailList>
              </DetailCard>
            </div>

            <DetailCard title="Update Status" icon={<FileText />}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Select
                  id="status"
                  label="Status"
                  options={STATUS_OPTIONS}
                  error={errors.status?.message}
                  {...register('status')}
                />
                <Textarea
                  id="adminNotes"
                  label="Admin Notes"
                  rows={4}
                  placeholder="Add internal notes about this complaint..."
                  error={errors.adminNotes?.message}
                  {...register('adminNotes')}
                />
                <div className="flex justify-end border-t border-(--border-color) pt-4">
                  <Button type="submit" variant="primary" disabled={isSaving} loading={isSaving}>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </DetailCard>

            {complaint.updatedAt && (
              <p className="text-right text-xs font-semibold text-(--color-text-muted)">
                Last updated: {formatDateTime(complaint.updatedAt)}
              </p>
            )}
          </div>
        )}
      </FormPage>

      <QuickResolveModal
        target={
          quickResolveOpen && complaint
            ? {
                _id: complaint._id,
                title: complaint.title,
                tenantName: complaint.tenant?.user?.name,
                roomNumber: complaint.tenant?.room?.roomNumber,
                category: complaint.category,
                priority: complaint.priority,
                status: complaint.status,
                adminNotes: complaint.adminNotes,
              }
            : null
        }
        onResolve={handleQuickResolve}
        onClose={() => setQuickResolveOpen(false)}
      />
    </>
  );
}
