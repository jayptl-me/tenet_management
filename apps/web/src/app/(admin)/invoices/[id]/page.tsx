'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileDown,
  MessageCircle,
  CreditCard,
  ReceiptText,
  IndianRupee,
  Calendar,
  User,
  Building,
  AlertCircle,
  CheckCircle,
  Clock,
  Ban,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { generateWhatsAppUrl } from '@/lib/whatsapp';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

interface LineItem {
  description: string;
  amount: number;
}

interface PaymentRecord {
  _id: string;
  amount: number;
  method: string;
  status: string;
  paidAt?: string;
  utrNumber?: string;
}

interface UserInfo {
  name: string;
  email?: string;
  phone?: string;
}

interface TenantInfo {
  _id: string;
  userId?: UserInfo;
  roomId?: {
    _id: string;
    roomNumber: string;
    floor?: { _id: string; name: string };
  };
}

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  tenantId?: TenantInfo;
  month: string;
  lineItems: LineItem[];
  rentAmount: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  payments?: PaymentRecord[];
  whatsAppUrl?: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  draft: { icon: <Clock className="h-4 w-4" />, label: 'Draft', className: 'bg-amber-100 text-amber-800 border-amber-400' },
  sent: { icon: <Clock className="h-4 w-4" />, label: 'Sent', className: 'bg-blue-100 text-blue-800 border-blue-400' },
  partial: { icon: <AlertCircle className="h-4 w-4" />, label: 'Partial', className: 'bg-orange-100 text-orange-800 border-orange-400' },
  paid: { icon: <CheckCircle className="h-4 w-4" />, label: 'Paid', className: 'bg-green-100 text-green-800 border-green-400' },
  overdue: { icon: <Ban className="h-4 w-4" />, label: 'Overdue', className: 'bg-red-100 text-red-800 border-red-400' },
  cancelled: { icon: <Ban className="h-4 w-4" />, label: 'Cancelled', className: 'bg-gray-100 text-gray-600 border-gray-400' },
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return `₹${amount.toLocaleString('en-IN')}`;
  } catch {
    return `₹${amount}`;
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatMonth(month: string): string {
  try {
    const [y, m] = month.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch {
    return month;
  }
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchInvoice() {
      setIsLoading(true);
      setError('');
      try {
        const res = await api
          .get(`invoices/${params.id}`)
          .json<{ success: boolean; data: InvoiceDetail }>();
        setInvoice(res.data);
      } catch {
        setError('Failed to load invoice details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvoice();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="border-t-brand-600 h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error || 'Invoice not found'}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const tenantName = invoice.tenantId?.userId?.name ?? 'N/A';
  const roomNumber = invoice.tenantId?.roomId?.roomNumber ?? 'N/A';
  const floorName = invoice.tenantId?.roomId?.floor?.name ?? 'N/A';
  const tenantEmail = invoice.tenantId?.userId?.email;
  const tenantPhone = invoice.tenantId?.userId?.phone;
  const statusConfig = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="hover:bg-gray-100 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            <ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">
              {invoice.invoiceNumber}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {formatMonth(invoice.month)} · Created {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 px-4 py-2 font-bold text-sm shadow-[3px_3px_0px_0px_currentColor] ${statusConfig.className}`}>
          {statusConfig.icon}
          {statusConfig.label}
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            <ReceiptText className="h-3.5 w-3.5" /> Total Amount
          </div>
          <p className="text-2xl font-black text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-emerald-400 bg-emerald-50 p-5 shadow-[4px_4px_0px_0px_#34d399]">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2">
            <CreditCard className="h-3.5 w-3.5" /> Paid
          </div>
          <p className="text-2xl font-black text-emerald-800">{formatCurrency(invoice.paidAmount)}</p>
        </div>
        <div className={`rounded-[var(--radius-lg)] border-2 p-5 shadow-[4px_4px_0px_0px_currentColor] ${invoice.balance > 0 ? 'border-rose-400 bg-rose-50 shadow-rose-400' : 'border-emerald-400 bg-emerald-50 shadow-emerald-400'}`}>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2 ${invoice.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            <IndianRupee className="h-3.5 w-3.5" /> Balance
          </div>
          <p className={`text-2xl font-black ${invoice.balance > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
            {formatCurrency(invoice.balance)}
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            <Calendar className="h-3.5 w-3.5" /> Due Date
          </div>
          <p className="text-2xl font-black text-gray-900">{formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Breakdown & Line Items */}
        <div className="lg:col-span-3 space-y-6">
          {/* Rent Breakdown */}
          <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
            <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-brand-600" />
              Breakdown
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-md)] border-2 border-blue-200 bg-blue-50 p-4 shadow-[2px_2px_0px_0px_#93c5fd]">
                <p className="text-blue-600 text-xs font-bold uppercase tracking-wider">Rent</p>
                <p className="text-blue-900 text-xl font-black mt-1">{formatCurrency(invoice.rentAmount)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border-2 border-amber-200 bg-amber-50 p-4 shadow-[2px_2px_0px_0px_#fcd34d]">
                <p className="text-amber-600 text-xs font-bold uppercase tracking-wider">Electricity</p>
                <p className="text-amber-900 text-xl font-black mt-1">{formatCurrency(invoice.electricityAmount)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border-2 border-purple-200 bg-purple-50 p-4 shadow-[2px_2px_0px_0px_#c4b5fd]">
                <p className="text-purple-600 text-xs font-bold uppercase tracking-wider">Other</p>
                <p className="text-purple-900 text-xl font-black mt-1">{formatCurrency(invoice.otherCharges)}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          {invoice.lineItems && invoice.lineItems.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
              <h3 className="font-black text-lg text-gray-900 mb-4">Line Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="font-black text-gray-600 pb-3 text-xs uppercase tracking-wider">Description</th>
                      <th className="font-black text-gray-600 pb-3 text-right text-xs uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoice.lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-semibold text-gray-900">{item.description}</td>
                        <td className="py-3 text-right font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td className="pt-3 text-right font-black text-gray-900 text-base uppercase">Total</td>
                      <td className="pt-3 text-right font-black text-gray-900 text-base">{formatCurrency(invoice.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
              <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                Payment History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="font-black text-gray-600 pb-3 text-xs uppercase tracking-wider">Amount</th>
                      <th className="font-black text-gray-600 pb-3 text-xs uppercase tracking-wider">Method</th>
                      <th className="font-black text-gray-600 pb-3 text-xs uppercase tracking-wider hidden sm:table-cell">UTR</th>
                      <th className="font-black text-gray-600 pb-3 text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                      <th className="font-black text-gray-600 pb-3 text-right text-xs uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoice.payments.map((p) => (
                      <tr key={p._id}>
                        <td className="py-3 font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                        <td className="py-3 text-gray-700 capitalize">{p.method.replace('_', ' ')}</td>
                        <td className="py-3 font-mono text-gray-600 text-xs hidden sm:table-cell">{p.utrNumber ?? '—'}</td>
                        <td className="py-3 text-gray-600 hidden sm:table-cell">{formatDate(p.paidAt)}</td>
                        <td className="py-3 text-right">
                          <span className={`inline-block rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-bold capitalize ${p.status === 'paid' ? 'border-emerald-400 bg-emerald-100 text-emerald-700' : 'border-amber-400 bg-amber-100 text-amber-700'}`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="rounded-[var(--radius-lg)] border-2 border-amber-300 bg-amber-50 p-5 shadow-[4px_4px_0px_0px_#fcd34d]">
              <p className="text-amber-700 text-xs font-bold uppercase tracking-wider mb-1">Notes</p>
              <p className="text-amber-900 font-semibold">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Tenant Info + Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tenant Card */}
          <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
            <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-brand-600" />
              Tenant
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Name</p>
                <p className="text-gray-900 font-extrabold text-lg mt-0.5">{tenantName}</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <Building className="h-3 w-3" /> Room
                  </p>
                  <p className="text-gray-900 font-extrabold mt-0.5">{roomNumber}</p>
                </div>
                <div className="flex-1">
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Floor</p>
                  <p className="text-gray-900 font-extrabold mt-0.5">{floorName}</p>
                </div>
              </div>
              {tenantEmail && (
                <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Email</p>
                  <p className="text-gray-700 font-semibold mt-0.5 text-sm">{tenantEmail}</p>
                </div>
              )}
              {tenantPhone && (
                <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Phone</p>
                  <p className="text-gray-700 font-semibold mt-0.5 text-sm">{tenantPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions Card */}
          <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
            <h3 className="font-black text-lg text-gray-900 mb-4">Actions</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.open(`${API_BASE_URL}/invoices/${invoice._id}/pdf`, '_blank')}
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-800 bg-gray-900 px-5 py-3 text-white font-bold text-sm shadow-[3px_3px_0px_0px_#374151] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] active:bg-gray-800"
              >
                <FileDown className="h-4 w-4" />
                Download PDF
              </button>
              {tenantPhone && (
                <button
                  onClick={() => {
                    const text = [
                      `Invoice ${invoice.invoiceNumber}`,
                      `Amount: ${formatCurrency(invoice.totalAmount)}`,
                      `Balance: ${formatCurrency(invoice.balance)}`,
                      `Download: ${API_BASE_URL}/invoices/${invoice._id}/pdf`,
                    ].join('\n');
                    window.open(generateWhatsAppUrl(tenantPhone, text), '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-emerald-600 bg-emerald-500 px-5 py-3 text-white font-bold text-sm shadow-[3px_3px_0px_0px_#059669] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] active:bg-emerald-600"
                >
                  <MessageCircle className="h-4 w-4" />
                  Share via WhatsApp
                </button>
              )}
              <button
                onClick={() => router.push(`/invoices/${invoice._id}/edit`)}
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-5 py-3 text-gray-700 font-bold text-sm shadow-[3px_3px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] hover:bg-gray-50"
              >
                Edit Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {invoice.updatedAt && (
        <p className="text-right text-xs text-gray-400 font-semibold">
          Last updated: {new Date(invoice.updatedAt).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}
