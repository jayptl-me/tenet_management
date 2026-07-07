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
  Image,
  CheckCircle,
  XCircle,
  MessageCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { generateWhatsAppUrl } from '@/lib/whatsapp';

interface PaymentDetail {
  _id: string;
  tenant?: { _id: string; user?: { name: string }; room?: { _id: string; roomNumber: string } };
  amount: number;
  method: string;    // API sends 'method' not 'mode'
  type: string;      // API sends 'type' not 'category'
  status: string;
  notes?: string;
  paidAt?: string;   // API sends 'paidAt' not 'transactionDate'
  createdAt: string;
  invoiceId?: string;
  invoiceNumber?: string;
  screenshotUrl?: string;
}

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Payment not found'}
        </div>
      </div>
    );
  }

  const formatMethod = (method: string) => method.replace(/_/g, ' ');
  const formatType = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);
  const formatStatus = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formattedDate = payment.paidAt || payment.createdAt;

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
              Payment Details
            </h2>
            <p className="text-surface-500 text-sm">Payment ID: {payment._id}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(payment.status)}
          label={formatStatus(payment.status)}
        />
      </div>

      {/* Amount Highlight */}
      <div className="bg-brand-50 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-surface-800 font-display mb-1 text-sm font-semibold">Amount</p>
        <p className="text-surface-900 font-display text-4xl font-extrabold">
          ₹{payment.amount?.toLocaleString()}
        </p>
      </div>

      {/* Payment Info Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">
          Payment Information
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Mode</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <CreditCard className="text-surface-400 h-3.5 w-3.5" />
              <span className="capitalize">{formatMethod(payment.method)}</span>
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Category</p>
            <p className="text-surface-700 text-sm">{formatType(payment.type)}</p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Status</p>
            <StatusBadge
              variant={statusToVariant(payment.status)}
              label={formatStatus(payment.status)}
            />
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Transaction Date</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Calendar className="text-surface-400 h-3.5 w-3.5" />
              {new Date(formattedDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Tenant Info Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Tenant Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Tenant Name</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <User className="text-surface-400 h-3.5 w-3.5" />
              {payment.tenant?.user?.name ?? 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Room</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Home className="text-surface-400 h-3.5 w-3.5" />
              {payment.tenant?.room?.roomNumber ?? 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Reference Card */}
      {(payment.invoiceId || payment.invoiceNumber) && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">
            Invoice Reference
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {payment.invoiceNumber && (
              <div>
                <p className="text-surface-800 font-display text-sm font-semibold">
                  Invoice Number
                </p>
                <p className="text-surface-700 flex items-center gap-1 text-sm">
                  <Receipt className="text-surface-400 h-3.5 w-3.5" />
                  {payment.invoiceNumber}
                </p>
              </div>
            )}
            {payment.invoiceId && (
              <div>
                <p className="text-surface-800 font-display text-sm font-semibold">Invoice ID</p>
                <p className="text-surface-700 font-mono text-sm text-xs">{payment.invoiceId}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes Card */}
      {payment.notes && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Notes</h3>
          <p className="text-surface-700 flex items-start gap-1 text-sm">
            <FileText className="text-surface-400 mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-pre-wrap">{payment.notes}</span>
          </p>
        </div>
      )}

      {/* Screenshot Card */}
      {payment.screenshotUrl && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Screenshot</h3>
          <a
            href={payment.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface-100 block max-w-sm overflow-hidden rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] ring-[color:var(--color-brand-500)] transition-shadow hover:ring-[length:var(--bw-default)]"
          >
            <img
              src={payment.screenshotUrl}
              alt="Payment Screenshot"
              className="w-full object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                target.parentElement!.classList.add(
                  'flex',
                  'items-center',
                  'justify-center',
                  'p-8',
                );
                target.parentElement!.innerHTML =
                  '<span class="text-surface-400 flex flex-col items-center gap-2"><svg class="h-10 w-10" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><span class="text-xs">Image unavailable</span></span>';
              }}
            />
          </a>
        </div>
      )}

      {/* Actions Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {payment.status === 'pending_verification' && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  try {
                    await api.post(`payments/${payment._id}/verify`, { json: { approved: true } }).json();
                    window.location.reload();
                  } catch { alert('Failed to verify payment'); }
                }}
              >
                <CheckCircle className="h-4 w-4" /> Approve Payment
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  try {
                    await api.post(`payments/${payment._id}/verify`, { json: { approved: false } }).json();
                    window.location.reload();
                  } catch { alert('Failed to reject payment'); }
                }}
              >
                <XCircle className="h-4 w-4" /> Reject Payment
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const phone = payment.tenant?.user?.name ? '' : '';
              const text = `Payment of Rs.${payment.amount?.toLocaleString()} received. Status: ${formatStatus(payment.status)}`;
              const url = generateWhatsAppUrl(phone, text);
              if (phone) window.open(url, '_blank', 'noopener,noreferrer');
            }}
            disabled={!payment.tenant?.user?.name}
          >
            <MessageCircle className="h-4 w-4" /> Share via WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
