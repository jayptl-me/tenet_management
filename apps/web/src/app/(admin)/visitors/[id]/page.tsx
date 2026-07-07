'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Home, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface VisitorDetail {
  _id: string;
  name: string;
  phone: string;
  purpose: string;
  tenant?: {
    _id: string;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string };
  };
  expectedArrival?: string;
  actualArrival?: string;
  checkIn?: string;
  checkOut?: string;
  departure?: string;
  status: string;
  approverName?: string;
  approverRelation?: string;
  notes?: string;
  createdAt: string;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function visitorStatusBadge(status: string) {
  const label = status.replace(/_/g, ' ');

  if (status === 'checked_in' || status === 'active' || status === 'approved') {
    return (
      <span className="inline-flex rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-700 shadow-[2px_2px_0px_0px_#a7f3d0]">
        {label}
      </span>
    );
  }
  if (status === 'pending' || status === 'expected') {
    return (
      <span className="inline-flex rounded-full border-2 border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-black text-amber-700 shadow-[2px_2px_0px_0px_#fcd34d]">
        {label}
      </span>
    );
  }
  if (status === 'checked_out' || status === 'departed' || status === 'rejected' || status === 'cancelled') {
    return (
      <span className="inline-flex rounded-full border-2 border-red-400 bg-red-50 px-3 py-0.5 text-xs font-black text-red-700 shadow-[2px_2px_0px_0px_#fca5a5]">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border-2 border-gray-300 bg-gray-50 px-3 py-0.5 text-xs font-black text-gray-600">
      {label}
    </span>
  );
}

export default function VisitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [visitor, setVisitor] = useState<VisitorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`visitors/${id}`)
      .json<{ success: boolean; data: VisitorDetail }>()
      .then((res) => {
        setVisitor(res.data);
      })
      .catch(() => {
        setError('Failed to load visitor details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error || !visitor) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error || 'Visitor not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">
              {visitor.name}
            </h2>
            <p className="text-sm text-gray-500">Visitor ID: {visitor._id}</p>
          </div>
        </div>
        {visitorStatusBadge(visitor.status)}
      </div>

      {/* Visitor Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Visitor Details */}
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="mb-4 font-black text-lg text-gray-900">
            Visitor Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Name</p>
              <p className="flex items-center gap-1 text-sm text-gray-700">
                <User className="h-3.5 w-3.5 text-gray-400" />
                {visitor.name}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Phone</p>
              <p className="flex items-center gap-1 text-sm text-gray-700">
                <Phone className="h-3.5 w-3.5 text-gray-400" />
                {visitor.phone}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Purpose</p>
              <p className="text-sm capitalize text-gray-700">{visitor.purpose}</p>
            </div>
          </div>
        </div>

        {/* Tenant Info */}
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="mb-4 font-black text-lg text-gray-900">Visiting</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Tenant</p>
              <p className="flex items-center gap-1 text-sm text-gray-700">
                <User className="h-3.5 w-3.5 text-gray-400" />
                {visitor.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Room</p>
              <p className="flex items-center gap-1 text-sm text-gray-700">
                <Home className="h-3.5 w-3.5 text-gray-400" />
                {visitor.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
            {visitor.approverName && (
              <div>
                <p className="text-sm font-semibold text-gray-700">Approved By</p>
                <p className="flex items-center gap-1 text-sm text-gray-700">
                  <CheckCircle className="h-3.5 w-3.5 text-gray-400" />
                  {visitor.approverName}
                  {visitor.approverRelation && ` (${visitor.approverRelation})`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="mb-4 font-black text-lg text-gray-900">Timeline</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-semibold text-gray-700">Expected Arrival</p>
            <p className="flex items-center gap-1 text-sm text-gray-700">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {formatDateTime(visitor.expectedArrival)}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Check In</p>
            <p className="flex items-center gap-1 text-sm text-gray-700">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {formatDateTime(visitor.checkIn || visitor.actualArrival)}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Check Out</p>
            <p className="flex items-center gap-1 text-sm text-gray-700">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {formatDateTime(visitor.checkOut || visitor.departure)}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Status</p>
            <div className="mt-1">{visitorStatusBadge(visitor.status)}</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {visitor.notes && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="mb-4 font-black text-lg text-gray-900">Notes</h3>
          <p className="flex items-start gap-1 text-sm text-gray-700">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="whitespace-pre-wrap">{visitor.notes}</span>
          </p>
        </div>
      )}
    </div>
  );
}