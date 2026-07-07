'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  User,
  Home,
  Calendar,
  FileText,
  Receipt,
  CheckCircle,
  XCircle,
  MessageCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { generateWhatsAppUrl } from '@/lib/whatsapp';

interface PaymentDetail {
  _id: string;
  tenant?: { _id: string; user?: { name: string; phone?: string }; room?: { _id: string; roomNumber: string } };
  amount: number;
  method: string;
  type: string;
  status: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  invoiceId?: string;
  invoiceNumber?: string;
  screenshotUrl?: string;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return '₹' + amount.toLocaleString('en-IN');
  } catch {
    return '₹' + amount;
  }
}

function formatDate(dateStr: string | null | undefined): string {
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

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'verified':
    case 'completed':
    case 'paid':
      return 'border-emerald-400 bg-emerald-50 text-emerald-700';
    case 'pending_verification':
    case 'pending':
      return 'border-amber-300 bg-amber-50 text-amber-700';
    case 'rejected':
    case 'failed':
      return 'border-red-400 bg-red-50 text-red-700';
    default:
      return 'border-gray-300 bg-gray-50 text-gray-700';
  }
}

function getAmountBadgeClasses(status: string): string {
  switch (status) {
    case 'verified':
    case 'completed':
    case 'paid':
      return 'border-emerald-400 bg-emerald-100 text-emerald-800';
    case 'pending_verification':
    case 'pending':
      return 'border-amber-300 bg-amber-100 text-amber-800';
    case 'rejected':
    case 'failed':
      return 'border-red-400 bg-red-100 text-red-800';
    default:
      return 'border-gray-300 bg-gray-100 text-gray-800';
  }
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`payments/${id}`)
      .json<{ success: boolean; data: PaymentDetail }>()
      .then((res) => {
        setPayment(res.data);
      })
      .catch(() => {
        setError('Failed to load payment details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error || 'Payment not found'}
        </div>
      </div>
    );
  }

  const formatMethod = (method: string) => method.replace(/_/g, ' ');
  const formatType = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);
  const formatStatusLabel = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formattedDate = payment.paidAt || payment.createdAt;
  const statusClasses = getStatusBadgeClasses(payment.status);
  const amountClasses = getAmountBadgeClasses(payment.status);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">
              Payment Details
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Transaction ID: {payment._id}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-[var(--radius-md)] border-2 px-3 py-1 text-sm font-black uppercase tracking-wide shadow-[3px_3px_0px_0px_#d1d5db] ${statusClasses}`}
        >
          {formatStatusLabel(payment.status)}
        </span>
      </div>

      {/* Amount Highlight */}
      <div
        className={`rounded-[var(--radius-lg)] border-2 p-6 text-center shadow-[4px_4px_0px_0px_#d1d5db] ${amountClasses}`}
      >
        <p className="font-bold text-sm mb-1 uppercase tracking-wide opacity-80">Amount</p>
        <p className="font-black text-4xl">{formatCurrency(payment.amount)}</p>
        {payment.type && (
          <p className="font-semibold text-sm mt-1 capitalize opacity-80">
            {formatType(payment.type)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payment Information Card */}
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-600" />
            Payment Information
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Method</p>
                <p className="font-semibold text-gray-900 text-sm mt-0.5 capitalize">
                  {formatMethod(payment.method)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</p>
                <p className="font-semibold text-gray-900 text-sm mt-0.5">
                  {formatType(payment.type)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</p>
                <span
                  className={`mt-1 inline-block rounded-[var(--radius-md)] border-2 px-2 py-0.5 text-xs font-black uppercase tracking-wide ${statusClasses}`}
                >
                  {formatStatusLabel(payment.status)}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Transaction Date
                </p>
                <p className="font-semibold text-gray-900 text-sm mt-0.5 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  {formatDate(formattedDate)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Information Card */}
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600" />
            Tenant Information
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name</p>
              <p className="font-semibold text-gray-900 text-sm mt-0.5">
                {payment.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Room</p>
              <p className="font-semibold text-gray-900 text-sm mt-0.5 flex items-center gap-1">
                <Home className="h-3.5 w-3.5 text-gray-400" />
                {payment.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Created</p>
              <p className="font-semibold text-gray-900 text-sm mt-0.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                {formatDateTime(payment.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Reference Card */}
      {(payment.invoiceId || payment.invoiceNumber) && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-gray-600" />
            Invoice Reference
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {payment.invoiceNumber && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Invoice Number
                </p>
                <p className="font-semibold text-gray-900 text-sm mt-0.5">
                  {payment.invoiceNumber}
                </p>
              </div>
            )}
            {payment.invoiceId && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Invoice ID
                </p>
                <p className="font-mono text-xs text-gray-700 mt-0.5 break-all">
                  {payment.invoiceId}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes Card */}
      {payment.notes && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            Notes
          </h3>
          <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
            {payment.notes}
          </p>
        </div>
      )}

      {/* Screenshot Card */}
      {payment.screenshotUrl && (
        <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            Payment Screenshot
          </h3>
          <a
            href={payment.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-sm overflow-hidden rounded-[var(--radius-md)] border-2 border-gray-300 shadow-[3px_3px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            <img
              src={payment.screenshotUrl}
              alt="Payment Screenshot"
              className="w-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.classList.add('flex', 'items-center', 'justify-center', 'p-10');
                  parent.innerHTML =
                    '<span class="text-gray-400 flex flex-col items-center gap-2 text-sm font-semibold"><svg class="h-10 w-10" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Image unavailable</span></span>';
                }
              }}
            />
          </a>
        </div>
      )}

      {/* Actions Card */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="font-black text-lg text-gray-900 mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {payment.status === 'pending_verification' && (
            <>
              <button
                type="button"
                disabled={actionLoading === 'approve'}
                onClick={async () => {
                  setActionLoading('approve');
                  try {
                    await api.post(`payments/${payment._id}/verify`, { json: { approved: true } }).json();
                    window.location.reload();
                  } catch {
                    alert('Failed to verify payment');
                  } finally {
                    setActionLoading(null);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-emerald-500 bg-emerald-500 px-4 py-2.5 text-white font-black text-sm shadow-[3px_3px_0px_0px_#059669] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4" />
                {actionLoading === 'approve' ? 'Processing...' : 'Approve Payment'}
              </button>
              <button
                type="button"
                disabled={actionLoading === 'reject'}
                onClick={async () => {
                  setActionLoading('reject');
                  try {
                    await api.post(`payments/${payment._id}/verify`, { json: { approved: false } }).json();
                    window.location.reload();
                  } catch {
                    alert('Failed to reject payment');
                  } finally {
                    setActionLoading(null);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-red-500 bg-red-500 px-4 py-2.5 text-white font-black text-sm shadow-[3px_3px_0px_0px_#dc2626] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <XCircle className="h-4 w-4" />
                {actionLoading === 'reject' ? 'Processing...' : 'Reject Payment'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              const phone = payment.tenant?.user?.phone ?? '';
              const text = `Payment of ${formatCurrency(payment.amount)} received. Status: ${formatStatusLabel(payment.status)}`;
              const url = generateWhatsAppUrl(phone, text);
              if (phone) window.open(url, '_blank', 'noopener,noreferrer');
            }}
            disabled={!payment.tenant?.user?.phone}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white px-4 py-2.5 text-gray-900 font-black text-sm shadow-[3px_3px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageCircle className="h-4 w-4" />
            Share via WhatsApp
          </button>
        </div>
      </div>

      {/* Footer Meta */}
      <p className="text-gray-400 text-xs text-right">
        Last updated: {formatDateTime(payment.paidAt || payment.createdAt)}
      </p>
    </div>
  );
}