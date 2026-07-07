'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Calendar, Home, CreditCard, LogOut, MessageCircle, Copy, AlertTriangle, IndianRupee, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TenantActivityTimeline } from '@/components/ui/TenantActivityTimeline';
import { ServiceStatusIndicator } from '@/components/ui/ServiceStatusIndicator';
import { DocumentUpload } from '@/components/ui/DocumentUpload';
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
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [duesLoading, setDuesLoading] = useState(false);
  const [duesData, setDuesData] = useState<{
    totalDue: number;
    unpaidInvoices: Array<{ _id: string; invoiceNumber: string; month: string; totalAmount: number; status: string }>;
    electricityDues: number;
    depositHeld: number;
    pendingPayments: number;
    checkedOut: boolean;
  } | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

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

  const handleCheckoutClick = async () => {
    if (!tenant) return;
    setShowCheckoutModal(true);
    setDuesLoading(true);
    setDuesData(null);
    setCheckoutError('');
    try {
      const res = await api
        .get(`tenants/${tenant._id}/dues`)
        .json<{ success: boolean; data: typeof duesData }>();
      setDuesData(res.data);
    } catch {
      setCheckoutError('Failed to fetch dues summary');
    } finally {
      setDuesLoading(false);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!tenant) return;
    setCheckingOut(true);
    setCheckoutError('');
    try {
      await api.post(`tenants/${tenant._id}/checkout`, { json: {} }).json();
      setShowCheckoutModal(false);
      window.location.reload();
    } catch {
      setCheckoutError('Failed to checkout tenant. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentUpload
            tenantId={tenant._id}
            docType="aadhaar"
            currentUrl={tenant.documents?.aadhaarUrl}
            onUploaded={(url) => {
              setTenant((prev) =>
                prev
                  ? {
                      ...prev,
                      documents: { ...prev.documents, aadhaarUrl: url },
                    }
                  : prev,
              );
            }}
          />
          <DocumentUpload
            tenantId={tenant._id}
            docType="photo"
            currentUrl={tenant.documents?.photoUrl}
            onUploaded={(url) => {
              setTenant((prev) =>
                prev
                  ? {
                      ...prev,
                      documents: { ...prev.documents, photoUrl: url },
                    }
                  : prev,
              );
            }}
          />
        </div>
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
            <Button variant="danger" size="sm" onClick={handleCheckoutClick}>
              <LogOut className="h-4 w-4" />
              Check Out
            </Button>
          )}
        </div>
      </div>

      {/* Checkout Dues Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning-600)]" />
              <h3 className="font-display text-surface-900 text-lg font-bold">
                Checkout {tenant.user?.name ?? 'Tenant'}
              </h3>
            </div>

            {duesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-brand-500 h-6 w-6 animate-spin" />
                <span className="text-surface-500 ml-2 text-sm">Loading dues summary...</span>
              </div>
            ) : checkoutError ? (
              <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-3 text-sm font-semibold">
                {checkoutError}
              </div>
            ) : duesData ? (
              <div className="space-y-4">
                {/* Dues breakdown */}
                <div className="bg-surface-50 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-800 font-display text-sm font-semibold">
                      Total Pending Dues
                    </span>
                    <span className="text-surface-900 font-display text-lg font-extrabold">
                      ₹{duesData.totalDue.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="text-surface-500 mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      Electricity: <span className="font-semibold">₹{duesData.electricityDues.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      Deposit Held: <span className="font-semibold">₹{duesData.depositHeld.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      Pending Payments: <span className="font-semibold">{duesData.pendingPayments}</span>
                    </div>
                  </div>
                </div>

                {/* Unpaid invoices list */}
                {duesData.unpaidInvoices.length > 0 && (
                  <div>
                    <p className="text-surface-800 font-display mb-2 text-sm font-semibold">
                      Unpaid Invoices ({duesData.unpaidInvoices.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {duesData.unpaidInvoices.map((inv) => (
                        <div
                          key={inv._id}
                          className="flex items-center justify-between rounded border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="text-surface-400 h-3.5 w-3.5" />
                            <span className="text-surface-700 font-mono text-xs">{inv.invoiceNumber}</span>
                            <span className="text-surface-500 text-xs">{inv.month}</span>
                          </div>
                          <span className="text-surface-900 text-sm font-semibold">
                            ₹{inv.totalAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {duesData.totalDue === 0 && duesData.unpaidInvoices.length === 0 && (
                  <div className="bg-success-50 text-success-700 rounded-lg border-[length:var(--bw-default)] border-[color:var(--color-success-300)] p-3 text-sm font-semibold">
                    No pending dues. The tenant can be checked out without any outstanding balance.
                  </div>
                )}

                <p className="text-surface-500 text-xs">
                  Checking out will free the bed, deactivate the tenant account, and set the move-out date.
                </p>
              </div>
            ) : null}

            {/* Modal actions */}
            <div className="mt-6 flex justify-end gap-3 border-t-[length:var(--bw-default)] border-t-[color:var(--border-color)] pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCheckoutModal(false);
                  setDuesData(null);
                  setCheckoutError('');
                }}
                disabled={checkingOut}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmCheckout}
                loading={checkingOut}
                disabled={duesLoading}
              >
                <LogOut className="h-4 w-4" />
                Confirm Checkout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Activity Timeline</h3>
        <TenantActivityTimeline tenantId={tenant._id} />
      </div>
    </div>
  );
}
