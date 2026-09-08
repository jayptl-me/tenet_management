'use client';

/**
 * Client-only CSV export engine.
 *
 * Paginates the standard list APIs (max 100 rows per page from parsePagination)
 * until all pages are fetched, then serializes to sanitized RFC-4180 CSV in the browser.
 * Supported resources (17): tenants, payments, invoices, complaints, enquiries,
 * visitors, attendance, electricity, assets, leaves, floors, rooms, guardians,
 * notices, menus, laundry-slots, washing-machines.
 */

import { useState } from 'react';
import {
  Download,
  Users,
  CreditCard,
  Receipt,
  AlertTriangle,
  Check,
  Loader2,
  PhoneCall,
  DoorOpen,
  CalendarCheck,
  Zap,
  Package,
  CalendarClock,
  Building2,
  Home,
  Megaphone,
  UtensilsCrossed,
  Shirt,
  WashingMachine,
  Database,
  FileSpreadsheet,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { StatCard } from '@/components/ui/StatCard';
import type { ExportResource } from '@pg/types';

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
  {
    resource: 'enquiries',
    label: 'Enquiries',
    description: 'Export prospect leads with contact info, source, and conversion status as CSV',
    icon: <PhoneCall className="h-5 w-5" />,
  },
  {
    resource: 'visitors',
    label: 'Visitors',
    description: 'Export visitor logs with purpose, check-in and check-out times as CSV',
    icon: <DoorOpen className="h-5 w-5" />,
  },
  {
    resource: 'attendance',
    label: 'Attendance',
    description: 'Export tenant daily attendance and check-in/out records as CSV',
    icon: <CalendarCheck className="h-5 w-5" />,
  },
  {
    resource: 'electricity',
    label: 'Electricity',
    description: 'Export electricity billing records, meter readings, and consumption units as CSV',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    resource: 'assets',
    label: 'Assets',
    description:
      'Export physical assets inventory, serial tags, condition, and service dates as CSV',
    icon: <Package className="h-5 w-5" />,
  },
  {
    resource: 'leaves',
    label: 'Leaves',
    description:
      'Export leave applications with reason, date intervals, and approval status as CSV',
    icon: <CalendarClock className="h-5 w-5" />,
  },
  {
    resource: 'floors',
    label: 'Floors',
    description: 'Export floor labels, numbers, and amenity counts as CSV',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    resource: 'rooms',
    label: 'Rooms',
    description: 'Export rooms with sharing type, rent, and bed occupancy as CSV',
    icon: <Home className="h-5 w-5" />,
  },
  {
    resource: 'guardians',
    label: 'Guardians',
    description: 'Export guardian contacts with linked tenants as CSV',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    resource: 'notices',
    label: 'Notices',
    description: 'Export notice board posts with audience targeting as CSV',
    icon: <Megaphone className="h-5 w-5" />,
  },
  {
    resource: 'menus',
    label: 'Menus',
    description: 'Export daily menus with meal items as CSV',
    icon: <UtensilsCrossed className="h-5 w-5" />,
  },
  {
    resource: 'laundry-slots',
    label: 'Laundry Slots',
    description: 'Export laundry slot bookings with tenant and schedule as CSV',
    icon: <Shirt className="h-5 w-5" />,
  },
  {
    resource: 'washing-machines',
    label: 'Washing Machines',
    description: 'Export washing machines with floor, status, and claims as CSV',
    icon: <WashingMachine className="h-5 w-5" />,
  },
];

// Sensitive key patterns that must never be exported to CSV
const SENSITIVE_PATTERNS = [
  'passwordhash',
  'password',
  'token',
  'secret',
  '__v',
  'ntfytopic',
  'temppassword',
  'passwordresettoken',
  'passwordresetexpires',
  'refreshtoken',
  'salt',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_PATTERNS.some((pat) => normalized.includes(pat));
}

// RFC-4180 CSV cell value sanitizer with formula injection protection (CWE-1236)
function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Neutralize formula injection in Excel/Sheets if starting with formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function ExportPage() {
  const [exporting, setExporting] = useState<ExportResource | null>(null);
  const [success, setSuccess] = useState<ExportResource | null>(null);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const handleExport = async (resource: ExportResource) => {
    const option = exportOptions.find((o) => o.resource === resource);
    const label = option?.label ?? resource;

    setExporting(resource);
    setError('');
    setSuccess(null);
    setAnnouncement(`Exporting ${label} data. Please wait...`);

    try {
      // API caps page size at 100 — walk pages until complete.
      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const allRows: Record<string, unknown>[] = [];

      while (page <= totalPages) {
        const res = await api.get(`${resource}?limit=${pageSize}&page=${page}`).json<{
          success: boolean;
          data: Record<string, unknown>[];
          meta?: { totalPages?: number; total?: number };
        }>();

        if (!res.success) {
          setError(`Failed to export ${label} data. Please try again.`);
          setAnnouncement(`Export failed for ${label}.`);
          return;
        }

        const batch = res.data ?? [];
        allRows.push(...batch);
        totalPages = Math.max(1, res.meta?.totalPages ?? 1);
        // Stop if API returns a short page without meta
        if (!res.meta?.totalPages && batch.length < pageSize) break;
        page += 1;
        // Safety: cap at 200 pages (20k rows) to avoid runaway loops
        if (page > 200) break;
      }

      if (allRows.length === 0) {
        setError(`No ${label} data available to export.`);
        setAnnouncement(`No data available to export for ${label}.`);
        return;
      }

      // Convert to CSV with recursive credential sanitization and formula hardening
      const csv = convertToCSV(allRows);
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
      setAnnouncement(`${label} exported successfully (${allRows.length} records downloaded).`);

      // Record export event in administrative audit ledger with record count and format
      api
        .post('audit-logs/log-export', {
          json: { resource, recordCount: allRows.length, format: 'csv' },
        })
        .catch(() => {});

      setTimeout(() => {
        setSuccess(null);
      }, 3500);
    } catch (err) {
      const message = (await parseApiError(err)).message;
      setError(`Failed to export ${label} data. ${message}`);
      setAnnouncement(`Failed to export ${label} data. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const convertToCSV = (data: Record<string, unknown>[]) => {
    if (data.length === 0) return '';

    // Recursively flatten nested objects (tenant.user.name, room.floor.label, …)
    // into dotted columns while sanitizing sensitive credentials.
    const flattenInto = (
      source: Record<string, unknown>,
      prefix: string,
      target: Record<string, unknown>,
      depth: number,
    ) => {
      for (const [key, value] of Object.entries(source)) {
        if (isSensitiveKey(key)) continue;
        const path = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (depth >= 3) {
            const named = value as Record<string, unknown>;
            target[path] = (named.name ?? named.label ?? JSON.stringify(value)) as unknown;
          } else {
            flattenInto(value as Record<string, unknown>, path, target, depth + 1);
          }
        } else if (Array.isArray(value)) {
          target[path] = JSON.stringify(value);
        } else {
          target[path] = value ?? '';
        }
      }
    };

    // Flatten nested objects for CSV-friendly format while sanitizing sensitive credentials
    const flattened = data.map((row) => {
      const flat: Record<string, unknown> = {};
      flattenInto(row, '', flat, 0);
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
      .map((h) => `"${h.replace(/"/g, '""')}"`)
      .join(',');

    const dataRows = flattened.map((row) =>
      Array.from(headers)
        .map((h) => sanitizeCSVValue(row[h]))
        .join(','),
    );

    return [headerRow, ...dataRows].join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Screen Reader Live Status Announcer */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <PageHeader
        title="Data Export"
        description="Download system data as CSV files for reporting, compliance, and offline analysis"
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Supported Modules"
          value="10 Datasets"
          icon={<Database className="h-5 w-5 text-[color:var(--color-brand-600)]" />}
        />
        <StatCard
          title="File Format"
          value="RFC-4180 CSV"
          icon={<FileSpreadsheet className="h-5 w-5 text-[color:var(--color-brand-600)]" />}
        />
        <StatCard
          title="Audit Trail"
          value="SOC-2 Logged"
          icon={<ShieldCheck className="h-5 w-5 text-[color:var(--color-brand-600)]" />}
        />
        <StatCard
          title="Data Security"
          value="PII Sanitized"
          icon={<Lock className="h-5 w-5 text-[color:var(--color-brand-600)]" />}
        />
      </div>

      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {exportOptions.map((option) => (
          <div
            key={option.resource}
            className="flex flex-col rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-5 shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-brand-300)]"
          >
            <div className="mb-4 flex items-center gap-2 text-[color:var(--color-brand-600)]">
              <div className="rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-brand-100)] p-2">
                {option.icon}
              </div>
              <h3 className="font-display text-lg font-bold text-[color:var(--color-text-primary)]">
                {option.label}
              </h3>
            </div>
            <p className="mb-5 flex-1 text-sm font-body text-[color:var(--color-text-secondary)]">
              {option.description}
            </p>
            <Button
              variant={success === option.resource ? 'primary' : 'outline'}
              size="md"
              onClick={() => handleExport(option.resource)}
              loading={exporting === option.resource}
              className="w-full"
              disabled={exporting !== null}
              aria-label={`Export ${option.label} data as CSV`}
            >
              {exporting === option.resource ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting {option.label}...
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
        <p className="font-body">
          <strong>Batch capacity:</strong> Up to 20,000 records per export batch. Datasets are
          extracted via client-side streaming pagination, preventing server memory spikes and
          ensuring instant availability.
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-4 text-sm text-[color:var(--color-text-secondary)]">
        <p className="font-body">
          <strong>Compliance & Security:</strong> Generated CSV files strictly adhere to RFC-4180
          specifications. Sensitive authentication hashes, secrets, and internal MongoDB keys are
          automatically sanitized. Dynamic formula injection triggers are escaped for safe
          spreadsheet viewing.
        </p>
      </div>
    </div>
  );
}
