'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Home, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

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
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !visitor) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Visitor not found'}
        </div>
      </div>
    );
  }

  const formatDate = (d?: string) =>
    d
      ? new Date(d).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const statusLabel = visitor.status.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">
              {visitor.name}
            </h2>
            <p className="text-surface-500 text-sm">Visitor ID: {visitor._id}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(visitor.status === 'checked_in' ? 'active' : visitor.status)}
          label={statusLabel}
        />
      </div>

      {/* Visitor Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Visitor Details */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">
            Visitor Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Name</p>
              <p className="text-surface-700 flex items-center gap-1 text-sm">
                <User className="text-surface-400 h-3.5 w-3.5" />
                {visitor.name}
              </p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Phone</p>
              <p className="text-surface-700 flex items-center gap-1 text-sm">
                <Phone className="text-surface-400 h-3.5 w-3.5" />
                {visitor.phone}
              </p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Purpose</p>
              <p className="text-surface-700 text-sm capitalize">{visitor.purpose}</p>
            </div>
          </div>
        </div>

        {/* Tenant Info */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Visiting</h3>
          <div className="space-y-4">
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Tenant</p>
              <p className="text-surface-700 flex items-center gap-1 text-sm">
                <User className="text-surface-400 h-3.5 w-3.5" />
                {visitor.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Room</p>
              <p className="text-surface-700 flex items-center gap-1 text-sm">
                <Home className="text-surface-400 h-3.5 w-3.5" />
                {visitor.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
            {visitor.approverName && (
              <div>
                <p className="text-surface-800 font-display text-sm font-semibold">Approved By</p>
                <p className="text-surface-700 flex items-center gap-1 text-sm">
                  <CheckCircle className="text-surface-400 h-3.5 w-3.5" />
                  {visitor.approverName}
                  {visitor.approverRelation && ` (${visitor.approverRelation})`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Timeline</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Expected Arrival</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Calendar className="text-surface-400 h-3.5 w-3.5" />
              {formatDate(visitor.expectedArrival)}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Check In</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Clock className="text-surface-400 h-3.5 w-3.5" />
              {formatDate(visitor.checkIn || visitor.actualArrival)}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Check Out</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Clock className="text-surface-400 h-3.5 w-3.5" />
              {formatDate(visitor.checkOut || visitor.departure)}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Status</p>
            <StatusBadge
              variant={statusToVariant(visitor.status === 'checked_in' ? 'active' : visitor.status)}
              label={statusLabel}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      {visitor.notes && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Notes</h3>
          <p className="text-surface-700 flex items-start gap-1 text-sm">
            <FileText className="text-surface-400 mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-pre-wrap">{visitor.notes}</span>
          </p>
        </div>
      )}
    </div>
  );
}
