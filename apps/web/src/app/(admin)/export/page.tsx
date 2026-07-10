'use client';

import { useState } from 'react';
import { Download, Users, CreditCard, Receipt, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

type ExportResource = 'tenants' | 'payments' | 'invoices' | 'complaints';

interface ExportOption {
  resource: ExportResource;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const exportOptions: ExportOption[] = [
  {
    resource: 'tenants',
    label: 'Tenants',
    description: 'Export all tenant data including room, rent, and contact details as CSV',
    icon: <Users className="h-5 w-5" />,
  },
  {
    resource: 'payments',
    label: 'Payments',
    description: 'Export payment records with status, mode, and amount details as CSV',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    resource: 'invoices',
    label: 'Invoices',
    description: 'Export invoice data with line items and payment status as CSV',
    icon: <Receipt className="h-5 w-5" />,
  },
  {
    resource: 'complaints',
    label: 'Complaints',
    description: 'Export complaint records with status, severity, and resolution as CSV',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
];

export default function ExportPage() {
  const [exporting, setExporting] = useState<ExportResource | null>(null);
  const [success, setSuccess] = useState<ExportResource | null>(null);
  const [error, setError] = useState('');

  const handleExport = async (resource: ExportResource) => {
    setExporting(resource);
    setError('');
    setSuccess(null);

    try {
      const res = await api.get(`${resource}?limit=5000`).json<{
        success: boolean;
        data: Record<string, unknown>[];
      }>();

      if (!res.success || !res.data || res.data.length === 0) {
        setError(`No ${resource} data available to export.`);
        return;
      }

      // Convert to CSV
      const csv = convertToCSV(res.data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().slice(0, 10);
      link.download = `${resource}_export_${date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(resource);
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError(`Failed to export ${resource} data. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const convertToCSV = (data: Record<string, unknown>[]) => {
    if (data.length === 0) return '';

    // Flatten nested objects for CSV-friendly format
    const flattened = data.map((row) => {
      const flat: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const nested = value as Record<string, unknown>;
          for (const [nKey, nValue] of Object.entries(nested)) {
            if (nValue && typeof nValue === 'object') {
              flat[`${key}_${nKey}`] =
                (nValue as Record<string, unknown>).name ?? JSON.stringify(nValue);
            } else {
              flat[`${key}_${nKey}`] = nValue ?? '';
            }
          }
        } else if (Array.isArray(value)) {
          flat[key] = JSON.stringify(value);
        } else {
          flat[key] = value ?? '';
        }
      }
      // Remove MongoDB internal fields
      delete flat.__v;
      delete flat.passwordHash;
      return flat;
    });

    // Collect all column headers
    const headers = new Set<string>();
    for (const row of flattened) {
      for (const key of Object.keys(row)) {
        headers.add(key);
      }
    }

    const headerRow = Array.from(headers)
      .map((h) => `"${h}"`)
      .join(',');

    const dataRows = flattened.map((row) =>
      Array.from(headers)
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(','),
    );

    return [headerRow, ...dataRows].join('\n');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Export"
        description="Download system data as CSV files for reporting"
      />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exportOptions.map((option) => (
          <div
            key={option.resource}
            className="flex flex-col rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)]"
          >
            <div className="mb-4 flex items-center gap-2 text-[color:var(--color-brand-600)]">
              <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-brand-100)] p-2">
                {option.icon}
              </div>
              <h3 className="font-display text-lg font-bold text-[color:var(--color-text-primary)]">
                {option.label}
              </h3>
            </div>
            <p className="font-[family:var(--font-body)] mb-5 flex-1 text-sm text-[color:var(--color-text-secondary)]">
              {option.description}
            </p>
            <Button
              variant={success === option.resource ? 'primary' : 'outline'}
              size="md"
              onClick={() => handleExport(option.resource)}
              loading={exporting === option.resource}
              className="w-full"
              disabled={exporting !== null}
            >
              {exporting === option.resource ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : success === option.resource ? (
                <>
                  <Check className="h-4 w-4 text-[color:var(--color-success-600)]" />
                  Exported Successfully
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export {option.label}
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-lg)] border-[length:var(--bw-default)] border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)] p-4 text-sm text-[color:var(--color-success-800)]">
        <p className="font-[family:var(--font-body)]">
          <strong>Export limit:</strong> Up to 5,000 records per export. For larger exports, use
          date range filters on the respective resource pages to narrow your selection before
          exporting.
        </p>
      </div>
    </div>
  );
}
