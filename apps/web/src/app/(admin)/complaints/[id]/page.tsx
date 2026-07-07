'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
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
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string; floor?: { name: string } };
  };
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
  adminNotes?: string;
  resolution?: string;
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

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'critical':
      return { border: 'border-red-400', bg: 'bg-red-50', text: 'text-red-700', shadow: 'shadow-red-400' };
    case 'high':
      return { border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', shadow: 'shadow-amber-400' };
    default:
      return { border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', shadow: 'shadow-blue-400' };
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return { border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', shadow: 'shadow-emerald-400', dot: 'bg-emerald-500' };
    case 'in_progress':
      return { border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', shadow: 'shadow-amber-400', dot: 'bg-amber-500' };
    case 'resolved':
      return { border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', shadow: 'shadow-blue-400', dot: 'bg-blue-500' };
    case 'dismissed':
      return { border: 'border-gray-400', bg: 'bg-gray-50', text: 'text-gray-600', shadow: 'shadow-gray-400', dot: 'bg-gray-400' };
    default:
      return { border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-600', shadow: 'shadow-gray-300', dot: 'bg-gray-400' };
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

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
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ComplaintUpdateForm>({
    resolver: zodResolver(complaintUpdateSchema),
    defaultValues: { status: 'open', adminNotes: '' },
  });

  useEffect(() => {
    async function fetchComplaint() {
      setIsLoading(true);
      setError('');
      try {
        const res = await api
          .get(`complaints/${params.id}`)
          .json<{ success: boolean; data: ComplaintDetail }>();
        setComplaint(res.data);
        reset({
          status: (res.data.status as ComplaintUpdateForm['status']) ?? 'open',
          adminNotes: res.data.adminNotes ?? '',
        });
      } catch {
        setError('Failed to load complaint details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchComplaint();
  }, [params.id, reset]);

  const onSubmit = async (data: ComplaintUpdateForm) => {
    setIsSaving(true);
    try {
      const res = await api
        .put(`complaints/${params.id}`, { json: data })
        .json<{ success: boolean }>();
      if (res.success) {
        toast.success('Complaint updated successfully');
        setComplaint((prev) =>
          prev ? { ...prev, status: data.status, adminNotes: data.adminNotes ?? '' } : prev,
        );
      } else {
        toast.error('Failed to update complaint');
      }
    } catch {
      toast.error('Failed to update complaint');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="space-y-6">
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error || 'Complaint not found'}
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-4 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    );
  }

  const severityBadge = getSeverityBadge(complaint.severity);
  const statusBadge = getStatusBadge(complaint.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">
              {complaint.title}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Reported on {formatDate(complaint.createdAt)}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border-2 px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] ${statusBadge.border} ${statusBadge.bg} ${statusBadge.text}`}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${statusBadge.dot}`} />
          {complaint.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Main detail cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Complaint details */}
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db] lg:col-span-2">
          <h3 className="font-black text-lg text-gray-900 mb-4">Complaint Details</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Category</p>
              <p className="text-gray-900 mt-1 text-sm font-bold capitalize">{complaint.category}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Severity</p>
              <p className="mt-1">
                <span
                  className={`inline-flex items-center rounded-[var(--radius-md)] border-2 px-2.5 py-0.5 text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] ${severityBadge.border} ${severityBadge.bg} ${severityBadge.text}`}
                >
                  {complaint.severity}
                </span>
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Status</p>
              <p className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-[var(--radius-md)] border-2 px-2.5 py-0.5 text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] ${statusBadge.border} ${statusBadge.bg} ${statusBadge.text}`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
                  {complaint.status.replace(/_/g, ' ')}
                </span>
              </p>
            </div>
          </div>

          <div className="border-t-2 border-gray-200 mt-5 pt-4">
            <p className="text-gray-500 mb-2 text-xs font-bold uppercase tracking-wider">
              Description
            </p>
            <p className="text-gray-700 whitespace-pre-wrap text-sm font-medium">
              {complaint.description}
            </p>
          </div>

          {complaint.resolution && (
            <div className="rounded-[var(--radius-md)] border-2 border-emerald-400 bg-emerald-50 p-4 mt-4 shadow-[2px_2px_0px_0px_#34d399]">
              <p className="text-emerald-700 mb-1 text-xs font-bold uppercase tracking-wider">
                Resolution
              </p>
              <p className="text-emerald-800 whitespace-pre-wrap text-sm font-semibold">
                {complaint.resolution}
              </p>
              {complaint.resolvedAt && (
                <p className="text-emerald-600 mt-2 text-xs font-semibold">
                  Resolved on: {formatDate(complaint.resolvedAt)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Reporter info card */}
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4">Reported By</h3>
          <div className="space-y-3">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Name</p>
              <p className="text-gray-900 mt-1 text-sm font-extrabold">
                {complaint.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Room</p>
              <p className="text-gray-900 mt-1 text-sm font-extrabold">
                {complaint.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
            {complaint.tenant?.user?.email && (
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Email</p>
                <p className="text-gray-700 mt-1 text-sm font-medium">
                  {complaint.tenant.user.email}
                </p>
              </div>
            )}
            {complaint.tenant?.user?.phone && (
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Phone</p>
                <p className="text-gray-700 mt-1 text-sm font-medium">
                  {complaint.tenant.user.phone}
                </p>
              </div>
            )}
            {complaint.tenant?.room?.floor?.name && (
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Floor</p>
                <p className="text-gray-700 mt-1 text-sm font-semibold">
                  {complaint.tenant.room.floor.name}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status update form */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="font-black text-lg text-gray-900 mb-4">Update Status</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Raw brutalist select */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="status"
              className="text-gray-800 text-sm font-bold"
            >
              Status
            </label>
            <select
              id="status"
              className={`w-full rounded-[var(--radius-md)] border-2 px-4 py-2.5 text-base font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-all ${
                errors.status
                  ? 'border-red-400 shadow-[2px_2px_0px_0px_#f87171]'
                  : 'border-gray-300 shadow-[2px_2px_0px_0px_#d1d5db]'
              }`}
              {...register('status')}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className="text-red-600 text-sm font-semibold">{errors.status.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="adminNotes"
              className="text-gray-800 text-sm font-bold"
            >
              Admin Notes
            </label>
            <textarea
              id="adminNotes"
              rows={4}
              className={`w-full rounded-[var(--radius-md)] border-2 px-4 py-2.5 text-base font-medium text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all ${
                errors.adminNotes
                  ? 'border-red-400 shadow-[2px_2px_0px_0px_#f87171]'
                  : 'border-gray-300 shadow-[2px_2px_0px_0px_#d1d5db]'
              }`}
              placeholder="Add internal notes about this complaint..."
              {...register('adminNotes')}
            />
            {errors.adminNotes && (
              <p className="text-red-600 text-sm font-semibold">{errors.adminNotes.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-800 bg-gray-800 px-5 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0px_0px_#374151] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_#374151] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Meta */}
      {complaint.updatedAt && (
        <p className="text-gray-400 text-right text-xs font-semibold">
          Last updated: {formatDateTime(complaint.updatedAt)}
        </p>
      )}
    </div>
  );
}