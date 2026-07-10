'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  Calendar,
  Home,
  Banknote,
  LogOut,
  MessageCircle,
  Copy,
  AlertTriangle,
  CreditCard,
  Loader2,
  User,
  Shield,
  Pencil,
  FileText,
  Activity,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TenantActivityTimeline } from '@/components/ui/TenantActivityTimeline';
import { DocumentUpload } from '@/components/ui/DocumentUpload';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
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
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
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
    unpaidInvoices: Array<{
      _id: string;
      invoiceNumber: string;
      month: string;
      totalAmount: number;
      status: string;
    }>;
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
      .then((res) => setTenant(res.data))
      .catch(() => setError('Failed to load tenant details'))
      .finally(() => setIsLoading(false));
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
      setCheckoutError('Failed to checkout tenant.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (!isLoading && (error || !tenant)) {
    return (
      <FormPage
        title="Tenant Details"
        description="View tenant information"
        backHref="/tenants"
        error={error || 'Tenant not found'}
        maxWidth="4xl"
      />
    );
  }

  return (
    <FormPage
      title={tenant?.user?.name ?? 'Tenant Details'}
      description={
        tenant ? `Bed ${tenant.bedId} · Room ${tenant.room?.roomNumber ?? 'N/A'}` : undefined
      }
      backHref="/tenants"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        tenant ? (
          <StatusBadge
            variant={statusToVariant(tenant.isActive ? 'active' : 'checked_out')}
            label={tenant.isActive ? 'Active' : 'Inactive'}
          />
        ) : undefined
      }
      actions={
        tenant ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/tenants/${tenant._id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {tenant && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Monthly Rent"
              value={formatCurrency(tenant.monthlyRent)}
              icon={<Banknote className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Deposit"
              value={formatCurrency(tenant.depositPaid)}
              icon={<CreditCard className="h-4 w-4" />}
              variant="brand"
            />
            <StatCard
              title="Move-in"
              value={formatDate(tenant.moveInDate)}
              icon={<Calendar className="h-4 w-4" />}
              variant="default"
            />
            <StatCard
              title="Move-out"
              value={formatDate(tenant.moveOutDate)}
              icon={<Calendar className="h-4 w-4" />}
              variant="default"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard title="Contact" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Email"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {tenant.user?.email ?? 'N/A'}
                    </span>
                  }
                />
                <DetailRow
                  label="Phone"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {tenant.user?.phone ?? 'N/A'}
                    </span>
                  }
                />
              </DetailList>
            </DetailCard>

            <DetailCard title="Room" icon={<Home />}>
              <DetailList>
                <DetailRow label="Room Number" value={tenant.room?.roomNumber ?? 'N/A'} />
                <DetailRow label="Floor" value={tenant.room?.floor?.label ?? 'N/A'} />
                <DetailRow
                  label="Bed ID"
                  value={<span className="font-mono text-sm font-bold">{tenant.bedId}</span>}
                />
              </DetailList>
            </DetailCard>
          </div>

          {(tenant.emergencyContact?.name || tenant.emergencyContact?.phone) && (
            <DetailCard title="Emergency Contact" icon={<Shield />} variant="warning">
              <DetailList>
                <DetailRow label="Name" value={tenant.emergencyContact.name ?? '—'} />
                <DetailRow label="Phone" value={tenant.emergencyContact.phone ?? '—'} />
                <DetailRow label="Relation" value={tenant.emergencyContact.relation ?? '—'} />
              </DetailList>
            </DetailCard>
          )}

          <DetailCard title="Documents" icon={<FileText />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocumentUpload
                tenantId={tenant._id}
                docType="aadhaar"
                currentUrl={tenant.documents?.aadhaarUrl}
                onUploaded={(url) =>
                  setTenant((prev) =>
                    prev
                      ? {
                          ...prev,
                          documents: { ...prev.documents, aadhaarUrl: url },
                        }
                      : prev,
                  )
                }
              />
              <DocumentUpload
                tenantId={tenant._id}
                docType="photo"
                currentUrl={tenant.documents?.photoUrl}
                onUploaded={(url) =>
                  setTenant((prev) =>
                    prev
                      ? {
                          ...prev,
                          documents: { ...prev.documents, photoUrl: url },
                        }
                      : prev,
                  )
                }
              />
            </div>
          </DetailCard>

          <DetailCard title="Actions" icon={<MessageCircle />}>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  const p = tenant.user?.phone ?? '';
                  window.open(
                    generateWhatsAppUrl(
                      p,
                      `Hi ${tenant.user?.name ?? 'Tenant'}, regarding your stay...`,
                    ),
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                disabled={!tenant.user?.phone}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  copyToClipboard(
                    `${tenant.user?.name ?? 'Tenant'} | ${tenant.user?.phone ?? ''} | Room ${tenant.room?.roomNumber ?? 'N/A'} | Bed ${tenant.bedId}`,
                  )
                }
              >
                <Copy className="h-4 w-4" /> Copy Info
              </Button>
              {tenant.isActive && (
                <Button variant="danger" onClick={handleCheckoutClick}>
                  <LogOut className="h-4 w-4" /> Check Out
                </Button>
              )}
            </div>
          </DetailCard>

          {showCheckoutModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)]">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning-500)]" />
                  <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">
                    Checkout {tenant.user?.name ?? 'Tenant'}
                  </h3>
                </div>
                {duesLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[color:var(--color-warning-500)]" />
                    <span className="text-[13px] font-semibold text-[color:var(--color-text-muted)]">
                      Loading dues...
                    </span>
                  </div>
                ) : checkoutError ? (
                  <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] p-3 text-[13px] font-semibold text-[color:var(--color-danger-700)]">
                    {checkoutError}
                  </div>
                ) : duesData ? (
                  <div className="space-y-4">
                    <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[color:var(--color-text-primary)]">
                          Total Pending Dues
                        </span>
                        <span className="text-lg font-extrabold text-[color:var(--color-text-primary)]">
                          {formatCurrency(duesData.totalDue)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] font-semibold text-[color:var(--color-text-muted)]">
                        <div>Electricity: {formatCurrency(duesData.electricityDues)}</div>
                        <div>Deposit Held: {formatCurrency(duesData.depositHeld)}</div>
                        <div>Pending Payments: {duesData.pendingPayments}</div>
                      </div>
                    </div>
                    {duesData.unpaidInvoices.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-bold text-[color:var(--color-text-primary)]">
                          Unpaid Invoices ({duesData.unpaidInvoices.length})
                        </p>
                        <div className="max-h-40 space-y-1 overflow-y-auto">
                          {duesData.unpaidInvoices.map((inv) => (
                            <div
                              key={inv._id}
                              className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[color:var(--border-color)] px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[color:var(--color-text-muted)]">
                                  {inv.invoiceNumber}
                                </span>
                                <span className="text-xs text-[color:var(--color-text-muted)]">
                                  {inv.month}
                                </span>
                              </div>
                              <span className="font-bold text-[color:var(--color-text-primary)]">
                                {formatCurrency(inv.totalAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {duesData.totalDue === 0 && duesData.unpaidInvoices.length === 0 && (
                      <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] p-3 text-[13px] font-semibold text-[color:var(--color-success-700)]">
                        No pending dues. Safe to checkout.
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="mt-6 flex justify-end gap-3 border-t border-[color:var(--border-color)] pt-4">
                  <Button
                    variant="outline"
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
                    onClick={handleConfirmCheckout}
                    loading={checkingOut}
                    disabled={duesLoading}
                  >
                    <LogOut className="h-4 w-4" /> Confirm Checkout
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DetailCard title="Activity Timeline" icon={<Activity />}>
            <TenantActivityTimeline tenantId={tenant._id} />
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
