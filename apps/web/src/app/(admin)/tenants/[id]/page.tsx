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
  FileText,
  Loader2,
  User,
  Shield,
  Pencil,
} from 'lucide-react';
import { api } from '@/lib/api';
import { TenantActivityTimeline } from '@/components/ui/TenantActivityTimeline';
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

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="border-t-brand-600 h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200" /></div>;
  }

  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-4 py-2 text-sm font-bold shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">{error || 'Tenant not found'}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
            <ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">{tenant.user?.name ?? 'Tenant Details'}</h2>
            <p className="text-gray-500 text-sm mt-0.5">Bed {tenant.bedId} · Room {tenant.room?.roomNumber ?? 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border-2 px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0px_0px_currentColor] ${tenant.isActive ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-emerald-400' : 'border-red-300 bg-red-50 text-red-600 shadow-red-300'}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${tenant.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
            {tenant.isActive ? 'Active' : 'Inactive'}
          </span>
          <button onClick={() => router.push(`/tenants/${tenant._id}/edit`)} className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-gray-600 hover:text-gray-900" title="Edit tenant">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2"><Banknote className="h-3.5 w-3.5" /> Rent</div>
          <p className="text-2xl font-black text-gray-900">{formatCurrency(tenant.monthlyRent)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-blue-400 bg-blue-50 p-5 shadow-[4px_4px_0px_0px_#60a5fa]">
          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2"><CreditCard className="h-3.5 w-3.5" /> Deposit</div>
          <p className="text-2xl font-black text-blue-800">{formatCurrency(tenant.depositPaid)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2"><Calendar className="h-3.5 w-3.5" /> Move-in</div>
          <p className="text-2xl font-black text-gray-900">{formatDate(tenant.moveInDate)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2"><Calendar className="h-3.5 w-3.5" /> Move-out</div>
          <p className="text-2xl font-black text-gray-900">{formatDate(tenant.moveOutDate)}</p>
        </div>
      </div>

      {/* Contact & Room */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2"><User className="h-5 w-5 text-amber-500" />Contact</h3>
          <div className="space-y-3">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Email</p>
              <p className="text-gray-900 font-semibold flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-gray-400" />{tenant.user?.email ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Phone</p>
              <p className="text-gray-900 font-semibold flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gray-400" />{tenant.user?.phone ?? 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2"><Home className="h-5 w-5 text-blue-500" />Room</h3>
          <div className="space-y-3">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Room Number</p>
              <p className="text-gray-900 font-extrabold text-lg">{tenant.room?.roomNumber ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Floor</p>
              <p className="text-gray-900 font-semibold">{tenant.room?.floor?.label ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Bed ID</p>
              <p className="text-gray-900 font-mono font-bold text-sm">{tenant.bedId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      {(tenant.emergencyContact?.name || tenant.emergencyContact?.phone) && (
        <div className="rounded-[var(--radius-lg)] border-2 border-orange-300 bg-orange-50 p-6 shadow-[4px_4px_0px_0px_#fdba74]">
          <h3 className="font-black text-lg text-orange-800 mb-4 flex items-center gap-2"><Shield className="h-5 w-5" />Emergency Contact</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><p className="text-orange-600 text-xs font-bold uppercase tracking-wider">Name</p><p className="text-orange-900 font-extrabold">{tenant.emergencyContact.name ?? '—'}</p></div>
            <div><p className="text-orange-600 text-xs font-bold uppercase tracking-wider">Phone</p><p className="text-orange-900 font-extrabold">{tenant.emergencyContact.phone ?? '—'}</p></div>
            <div><p className="text-orange-600 text-xs font-bold uppercase tracking-wider">Relation</p><p className="text-orange-900 font-extrabold">{tenant.emergencyContact.relation ?? '—'}</p></div>
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="font-black text-lg text-gray-900 mb-4">Documents</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DocumentUpload tenantId={tenant._id} docType="aadhaar" currentUrl={tenant.documents?.aadhaarUrl} onUploaded={(url) => setTenant((prev) => prev ? { ...prev, documents: { ...prev.documents, aadhaarUrl: url } } : prev)} />
          <DocumentUpload tenantId={tenant._id} docType="photo" currentUrl={tenant.documents?.photoUrl} onUploaded={(url) => setTenant((prev) => prev ? { ...prev, documents: { ...prev.documents, photoUrl: url } } : prev)} />
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="font-black text-lg text-gray-900 mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => { const p = tenant.user?.phone ?? ''; window.open(generateWhatsAppUrl(p, `Hi ${tenant.user?.name ?? 'Tenant'}, regarding your stay...`), '_blank', 'noopener,noreferrer'); }} disabled={!tenant.user?.phone} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-emerald-600 bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0px_0px_#059669] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
          <button onClick={() => copyToClipboard(`${tenant.user?.name ?? 'Tenant'} | ${tenant.user?.phone ?? ''} | Room ${tenant.room?.roomNumber ?? 'N/A'} | Bed ${tenant.bedId}`)} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-[3px_3px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]">
            <Copy className="h-4 w-4" /> Copy Info
          </button>
          {tenant.isActive && (
            <button onClick={handleCheckoutClick} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-red-600 bg-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0px_0px_#dc2626] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]">
              <LogOut className="h-4 w-4" /> Check Out
            </button>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-lg)] border-2 border-gray-800 bg-white p-6 shadow-[6px_6px_0px_0px_#1f2937]">
            <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><h3 className="font-black text-lg text-gray-900">Checkout {tenant.user?.name ?? 'Tenant'}</h3></div>
            {duesLoading ? (
              <div className="flex items-center justify-center py-8 gap-2"><Loader2 className="h-5 w-5 animate-spin text-amber-500" /><span className="text-gray-500 text-sm font-semibold">Loading dues...</span></div>
            ) : checkoutError ? (
              <div className="rounded-[var(--radius-md)] border-2 border-red-300 bg-red-50 p-3 text-red-700 text-sm font-semibold shadow-[2px_2px_0px_0px_#fca5a5]">{checkoutError}</div>
            ) : duesData ? (
              <div className="space-y-4">
                <div className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-gray-50 p-4 shadow-[2px_2px_0px_0px_#d1d5db]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-800 font-bold text-sm">Total Pending Dues</span>
                    <span className="text-gray-900 font-black text-lg">{formatCurrency(duesData.totalDue)}</span>
                  </div>
                  <div className="text-gray-500 mt-2 grid grid-cols-2 gap-2 text-xs font-semibold">
                    <div>Electricity: {formatCurrency(duesData.electricityDues)}</div>
                    <div>Deposit Held: {formatCurrency(duesData.depositHeld)}</div>
                    <div>Pending Payments: {duesData.pendingPayments}</div>
                  </div>
                </div>
                {duesData.unpaidInvoices.length > 0 && (
                  <div>
                    <p className="text-gray-800 font-bold text-sm mb-2">Unpaid Invoices ({duesData.unpaidInvoices.length})</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {duesData.unpaidInvoices.map((inv) => (
                        <div key={inv._id} className="flex items-center justify-between rounded-[var(--radius-sm)] border-2 border-gray-200 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-700 font-mono text-xs font-bold">{inv.invoiceNumber}</span><span className="text-gray-400 text-xs">{inv.month}</span></div>
                          <span className="text-gray-900 font-bold">{formatCurrency(inv.totalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {duesData.totalDue === 0 && duesData.unpaidInvoices.length === 0 && (
                  <div className="rounded-[var(--radius-md)] border-2 border-emerald-300 bg-emerald-50 p-3 text-emerald-700 text-sm font-semibold shadow-[2px_2px_0px_0px_#6ee7b7]">No pending dues. Safe to checkout.</div>
                )}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3 border-t-2 border-gray-200 pt-4">
              <button onClick={() => { setShowCheckoutModal(false); setDuesData(null); setCheckoutError(''); }} disabled={checkingOut} className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-[2px_2px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50">Cancel</button>
              <button onClick={handleConfirmCheckout} disabled={checkingOut || duesLoading} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-red-600 bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0px_0px_#dc2626] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50">
                {checkingOut && <Loader2 className="h-4 w-4 animate-spin" />}
                <LogOut className="h-4 w-4" /> Confirm Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="font-black text-lg text-gray-900 mb-4">Activity Timeline</h3>
        <TenantActivityTimeline tenantId={tenant._id} />
      </div>
    </div>
  );
}
