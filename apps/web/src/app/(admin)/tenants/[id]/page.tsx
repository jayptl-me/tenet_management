'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Calendar, Home, CreditCard, FileText, LogOut, MessageCircle, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TenantActivityTimeline } from '@/components/ui/TenantActivityTimeline';
import { ServiceStatusIndicator } from '@/components/ui/ServiceStatusIndicator';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';

interface TenantDetail {
  _id: string;
  user?: { name: string; email: string; phone: string };
  room?: { _id: string; roomNumber: string; floor?: { _id: string; label: string } };
  bedId: string;
  monthlyRent: number;
  depositPaid: number;
  moveInDate: string;
  moveOutDate: string | null;
  isActive: boolean;
  documents?: { aadhaarUrl?: string; photoUrl?: string };
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  createdAt: string;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`tenants/${id}`)
      .json<{ success: boolean; data: TenantDetail }>()
      .then((res) => {
        setTenant(res.data);
      })
      .catch(() => {
        setError('Failed to load tenant details');
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

  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Tenant not found'}
        </div>
      </div>
    );
  }

  const statusLabel = tenant.isActive ? 'Active' : 'Inactive';

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
              {tenant.user?.name ?? 'Tenant Details'}
            </h2>
            <p className="text-surface-500 text-sm">Tenant ID: {tenant._id}</p>
          </div>
        </div>
        <StatusBadge variant={statusToVariant(statusLabel)} label={statusLabel} />
      </div>

      {/* Personal Info Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Personal Info</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Name</p>
            <p className="text-surface-700 text-sm">{tenant.user?.name ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Email</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Mail className="text-surface-400 h-3.5 w-3.5" />
              {tenant.user?.email ?? 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Phone</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Phone className="text-surface-400 h-3.5 w-3.5" />
              {tenant.user?.phone ?? 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Room Details Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Room Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Room</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Home className="text-surface-400 h-3.5 w-3.5" />
              {tenant.room?.roomNumber ?? 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Bed ID</p>
            <p className="text-surface-700 text-sm">{tenant.bedId ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Floor</p>
            <p className="text-surface-700 text-sm">{tenant.room?.floor?.label ?? 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Financial Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Financial</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Monthly Rent</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <CreditCard className="text-surface-400 h-3.5 w-3.5" />₹
              {tenant.monthlyRent?.toLocaleString() ?? '0'}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Deposit Paid</p>
            <p className="text-surface-700 text-sm">
              ₹{tenant.depositPaid?.toLocaleString() ?? '0'}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Move-in Date</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Calendar className="text-surface-400 h-3.5 w-3.5" />
              {tenant.moveInDate
                ? new Date(tenant.moveInDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Move-out Date</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Calendar className="text-surface-400 h-3.5 w-3.5" />
              {tenant.moveOutDate
                ? new Date(tenant.moveOutDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Contact Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Emergency Contact</h3>
        {tenant.emergencyContact &&
        (tenant.emergencyContact.name || tenant.emergencyContact.phone) ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Name</p>
              <p className="text-surface-700 text-sm">{tenant.emergencyContact.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Phone</p>
              <p className="text-surface-700 text-sm">{tenant.emergencyContact.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Relation</p>
              <p className="text-surface-700 text-sm">{tenant.emergencyContact.relation ?? '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-surface-500 text-sm">No emergency contact on file</p>
        )}
      </div>

      {/* Documents Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Documents</h3>
        {tenant.documents ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-surface-800 font-display mb-1 text-sm font-semibold">
                <FileText className="text-surface-400 mr-1 inline h-3.5 w-3.5" />
                Aadhaar
              </p>
              {tenant.documents.aadhaarUrl ? (
                <a
                  href={tenant.documents.aadhaarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-800 text-sm underline"
                >
                  View Document
                </a>
              ) : (
                <p className="text-surface-400 text-sm">Not uploaded</p>
              )}
            </div>
            <div>
              <p className="text-surface-800 font-display mb-1 text-sm font-semibold">
                <FileText className="text-surface-400 mr-1 inline h-3.5 w-3.5" />
                Photo
              </p>
              {tenant.documents.photoUrl ? (
                <a
                  href={tenant.documents.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-800 text-sm underline"
                >
                  View Photo
                </a>
              ) : (
                <p className="text-surface-400 text-sm">Not uploaded</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-surface-500 text-sm">No documents on file</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const phone = tenant.user?.phone ?? '';
              const name = tenant.user?.name ?? 'Tenant';
              const url = generateWhatsAppUrl(phone, `Hi ${name}, regarding your stay at our PG...`);
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            disabled={!tenant.user?.phone}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const text = `${tenant.user?.name ?? 'Tenant'} | ${tenant.user?.phone ?? ''} | Room ${tenant.room?.roomNumber ?? 'N/A'} | Bed ${tenant.bedId}`;
              copyToClipboard(text);
            }}
          >
            <Copy className="h-4 w-4" />
            Copy Info
          </Button>
          {tenant.isActive && (
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!confirm(`Check out ${tenant.user?.name ?? 'this tenant'}?`)) return;
                try {
                  await api.post(`tenants/${tenant._id}/checkout`, { json: {} }).json();
                  window.location.reload();
                } catch {
                  alert('Failed to checkout tenant');
                }
              }}
            >
              <LogOut className="h-4 w-4" />
              Check Out
            </Button>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Activity Timeline</h3>
        <TenantActivityTimeline tenantId={tenant._id} />
      </div>
    </div>
  );
}
