'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  tenant?: {
    _id: string;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string; floor?: { name: string } };
  };
  lineItems?: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
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
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Invoice not found'}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const tenantName = invoice.tenant?.user?.name ?? 'N/A';
  const roomNumber = invoice.tenant?.room?.roomNumber ?? 'N/A';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">
              Invoice {invoice.invoiceNumber}
            </h2>
            <p className="text-surface-500 mt-0.5 text-sm">
              Created on{' '}
              {new Date(invoice.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(invoice.status)}
          label={invoice.status.replace(/_/g, ' ')}
        />
      </div>

      {/* Main detail cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Invoice info */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)] lg:col-span-2">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Invoice Number
              </p>
              <p className="text-surface-900 mt-1 font-mono text-base font-bold">
                {invoice.invoiceNumber}
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Tenant
              </p>
              <p className="text-surface-900 mt-1 text-base font-semibold">{tenantName}</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Room
              </p>
              <p className="text-surface-900 mt-1 text-base font-semibold">{roomNumber}</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Due Date
              </p>
              <p className="text-surface-900 mt-1 text-base font-semibold">
                {new Date(invoice.dueDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Status
              </p>
              <p className="mt-1">
                <StatusBadge
                  variant={statusToVariant(invoice.status)}
                  label={invoice.status.replace(/_/g, ' ')}
                />
              </p>
            </div>
            {invoice.notes && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Notes
                </p>
                <p className="text-surface-700 mt-1 text-sm">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Amount summary */}
        <div className="bg-surface-50 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Amount Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-surface-600 text-sm">Total Amount</span>
              <span className="text-surface-900 text-base font-bold">
                ₹{invoice.totalAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-600 text-sm">Paid Amount</span>
              <span className="text-success-700 text-base font-bold">
                ₹{invoice.paidAmount.toLocaleString()}
              </span>
            </div>
            <div className="border-surface-200 flex justify-between border-t-2 pt-3">
              <span className="text-surface-800 text-sm font-semibold">Balance Due</span>
              <span
                className={`text-lg font-extrabold ${invoice.balance > 0 ? 'text-danger-600' : 'text-success-700'}`}
              >
                ₹{invoice.balance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      {invoice.lineItems && invoice.lineItems.length > 0 && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">Line Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-surface-200 border-b-2">
                  <th className="font-display text-surface-700 pb-2 font-bold">Description</th>
                  <th className="font-display text-surface-700 pb-2 text-center font-bold">Qty</th>
                  <th className="font-display text-surface-700 pb-2 text-right font-bold">Rate</th>
                  <th className="font-display text-surface-700 pb-2 text-right font-bold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => (
                  <tr key={idx} className="border-surface-100 border-b">
                    <td className="font-[family:var(--font-body)] text-surface-900 py-3">
                      {item.description}
                    </td>
                    <td className="text-surface-700 py-3 text-center">{item.quantity}</td>
                    <td className="text-surface-700 py-3 text-right">
                      ₹{item.rate.toLocaleString()}
                    </td>
                    <td className="text-surface-900 py-3 text-right font-semibold">
                      ₹{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {invoice.subtotal !== undefined && (
                  <tr>
                    <td colSpan={3} className="text-surface-600 pt-3 text-right text-sm">
                      Subtotal
                    </td>
                    <td className="text-surface-900 pt-3 text-right font-semibold">
                      ₹{invoice.subtotal.toLocaleString()}
                    </td>
                  </tr>
                )}
                {invoice.taxAmount !== undefined && invoice.taxAmount > 0 && (
                  <tr>
                    <td colSpan={3} className="text-surface-600 pt-1 text-right text-sm">
                      Tax
                    </td>
                    <td className="text-surface-900 pt-1 text-right font-semibold">
                      ₹{invoice.taxAmount.toLocaleString()}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="text-surface-900 pt-2 text-right text-base font-bold">
                    Total
                  </td>
                  <td className="text-surface-900 pt-2 text-right text-base font-extrabold">
                    ₹{invoice.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tenant info card */}
      {invoice.tenant && (
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-extrabold">
            Tenant Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Name
              </p>
              <p className="text-surface-900 mt-1 text-sm font-semibold">{tenantName}</p>
            </div>
            {invoice.tenant.user?.email && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Email
                </p>
                <p className="text-surface-700 mt-1 text-sm">{invoice.tenant.user.email}</p>
              </div>
            )}
            {invoice.tenant.user?.phone && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Phone
                </p>
                <p className="text-surface-700 mt-1 text-sm">{invoice.tenant.user.phone}</p>
              </div>
            )}
            {invoice.tenant.room?.floor?.name && (
              <div>
                <p className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                  Floor
                </p>
                <p className="text-surface-700 mt-1 text-sm">{invoice.tenant.room.floor.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meta */}
      {invoice.updatedAt && (
        <p className="text-surface-400 text-right text-xs">
          Last updated: {new Date(invoice.updatedAt).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}
