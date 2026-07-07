'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TenantActivityTimeline } from '@/components/ui/TenantActivityTimeline';
import { DocumentUpload } from '@/components/ui/DocumentUpload';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

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
  try { return `₹${amount.toLocaleString('en-IN')}`; } catch { return `₹${amount}`; }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
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
    api.get(`tenants/${id}`).json<{ success: boolean; data: TenantDetail }>()
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
      const res = await api.get(`tenants/${tenant._id}/dues`).json<{ success: boolean; data: typeof duesData }>();
      setDuesData(res.data);
    } catch { setCheckoutError('Failed to fetch dues summary'); } finally { setDuesLoading(false); }
  };

  const handleConfirmCheckout = async () => {
    if (!tenant) return;
    setCheckingOut(true);
    setCheckoutError('');
    try { await api.post(`tenants/${tenant._id}/checkout`, { json: {} }).json(); setShowCheckoutModal(false); window.location.reload(); }
    catch { setCheckoutError('Failed to checkout tenant.'); } finally { setCheckingOut(false); }
  };

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Tenant not found'}</p>
        </div>
      </div>
    );
  }

  // ── Data State ───────────────────────────────
  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">{tenant.user?.name ?? 'Tenant Details'}</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Bed {tenant.bedId} · Room {tenant.room?.roomNumber ?? 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            variant={statusToVariant(tenant.isActive ? 'active' : 'checked_out')}
            label={tenant.isActive ? 'Active' : 'Inactive'}
          />
          <Button variant="outline" size="icon" onClick={() => router.push(`/tenants/${tenant._id}/edit`)} title="Edit tenant">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Monthly Rent" value={formatCurrency(tenant.monthlyRent)} icon={<Banknote className="h-4 w-4" />} variant="default" />
        <StatCard title="Deposit" value={formatCurrency(tenant.depositPaid)} icon={<CreditCard className="h-4 w-4" />} variant="brand" />
        <StatCard title="Move-in" value={formatDate(tenant.moveInDate)} icon={<Calendar className="h-4 w-4" />} variant="default" />
        <StatCard title="Move-out" value={formatDate(tenant.moveOutDate)} icon={<Calendar className="h-4 w-4" />} variant="default" />
      </motion.div>

      {/* ── Contact & Room ─────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <User className="h-5 w-5 text-[color:var(--color-brand-500)]" />Contact
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Email</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Mail className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{tenant.user?.email ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Phone</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Phone className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{tenant.user?.phone ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <Home className="h-5 w-5 text-[color:var(--color-brand-500)]" />Room
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room Number</p>
              <p className="text-lg font-extrabold text-[color:var(--color-text-primary)]">{tenant.room?.roomNumber ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Floor</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{tenant.room?.floor?.label ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Bed ID</p>
              <p className="font-mono text-sm font-bold text-[color:var(--color-text-primary)]">{tenant.bedId}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Emergency Contact ───────────────────── */}
      {(tenant.emergencyContact?.name || tenant.emergencyContact?.phone) && (
        <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-warning-800)]">
            <Shield className="h-5 w-5" />Emergency Contact
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-warning-600)]">Name</p>
              <p className="font-extrabold text-[color:var(--color-warning-900)]">{tenant.emergencyContact.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-warning-600)]">Phone</p>
              <p className="font-extrabold text-[color:var(--color-warning-900)]">{tenant.emergencyContact.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-warning-600)]">Relation</p>
              <p className="font-extrabold text-[color:var(--color-warning-900)]">{tenant.emergencyContact.relation ?? '—'}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Documents ───────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Documents</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentUpload tenantId={tenant._id} docType="aadhaar" currentUrl={tenant.documents?.aadhaarUrl} onUploaded={(url) => setTenant((prev) => prev ? { ...prev, documents: { ...prev.documents, aadhaarUrl: url } } : prev)} />
          <DocumentUpload tenantId={tenant._id} docType="photo" currentUrl={tenant.documents?.photoUrl} onUploaded={(url) => setTenant((prev) => prev ? { ...prev, documents: { ...prev.documents, photoUrl: url } } : prev)} />
        </div>
      </motion.div>

      {/* ── Actions ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => {
              const p = tenant.user?.phone ?? '';
              window.open(generateWhatsAppUrl(p, `Hi ${tenant.user?.name ?? 'Tenant'}, regarding your stay...`), '_blank', 'noopener,noreferrer');
            }}
            disabled={!tenant.user?.phone}
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={() => copyToClipboard(`${tenant.user?.name ?? 'Tenant'} | ${tenant.user?.phone ?? ''} | Room ${tenant.room?.roomNumber ?? 'N/A'} | Bed ${tenant.bedId}`)}
          >
            <Copy className="h-4 w-4" /> Copy Info
          </Button>
          {tenant.isActive && (
            <Button variant="danger" onClick={handleCheckoutClick}>
              <LogOut className="h-4 w-4" /> Check Out
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Checkout Modal ──────────────────────── */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-modal)]">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning-500)]" />
              <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">Checkout {tenant.user?.name ?? 'Tenant'}</h3>
            </div>
            {duesLoading ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[color:var(--color-warning-500)]" />
                <span className="text-[13px] font-semibold text-[color:var(--color-text-muted)]">Loading dues...</span>
              </div>
            ) : checkoutError ? (
              <div className="rounded-lg border border-[color:var(--color-danger-300)] bg-[color:var(--color-danger-50)] p-3 text-[13px] font-semibold text-[color:var(--color-danger-700)]">{checkoutError}</div>
            ) : duesData ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[color:var(--color-text-primary)]">Total Pending Dues</span>
                    <span className="text-lg font-extrabold text-[color:var(--color-text-primary)]">{formatCurrency(duesData.totalDue)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] font-semibold text-[color:var(--color-text-muted)]">
                    <div>Electricity: {formatCurrency(duesData.electricityDues)}</div>
                    <div>Deposit Held: {formatCurrency(duesData.depositHeld)}</div>
                    <div>Pending Payments: {duesData.pendingPayments}</div>
                  </div>
                </div>
                {duesData.unpaidInvoices.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-bold text-[color:var(--color-text-primary)]">Unpaid Invoices ({duesData.unpaidInvoices.length})</p>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {duesData.unpaidInvoices.map((inv) => (
                        <div key={inv._id} className="flex items-center justify-between rounded-lg border border-[color:var(--border-color)] px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[color:var(--color-text-muted)]">{inv.invoiceNumber}</span>
                            <span className="text-xs text-[color:var(--color-text-muted)]">{inv.month}</span>
                          </div>
                          <span className="font-bold text-[color:var(--color-text-primary)]">{formatCurrency(inv.totalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {duesData.totalDue === 0 && duesData.unpaidInvoices.length === 0 && (
                  <div className="rounded-lg border border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] p-3 text-[13px] font-semibold text-[color:var(--color-success-700)]">No pending dues. Safe to checkout.</div>
                )}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3 border-t border-[color:var(--border-color)] pt-4">
              <Button variant="outline" onClick={() => { setShowCheckoutModal(false); setDuesData(null); setCheckoutError(''); }} disabled={checkingOut}>Cancel</Button>
              <Button variant="danger" onClick={handleConfirmCheckout} loading={checkingOut} disabled={duesLoading}>
                <LogOut className="h-4 w-4" /> Confirm Checkout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Timeline ───────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Activity Timeline</h3>
        <TenantActivityTimeline tenantId={tenant._id} />
      </motion.div>
    </motion.div>
  );
}
