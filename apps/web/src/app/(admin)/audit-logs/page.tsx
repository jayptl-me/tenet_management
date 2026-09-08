'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollText, Eye, X, Download, Loader2, Search, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { modalContent } from '@/lib/animations';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';

interface AuditLogRow {
  _id: string;
  userId?: { _id: string; name: string; email: string; role: string };
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ip?: string;
  timestamp: string;
}

const DEFAULT_ACTIONS = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'payment_verify',
  'complaint_status_change',
  'tenant_checkout',
  'tenant_transfer',
  'settings_change',
  'notification_send',
  'visitor_approve',
  'export',
  'reconcile',
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'payment', label: 'Payment' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'service', label: 'Service' },
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'notice', label: 'Notice' },
  { value: 'notification', label: 'Notification' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'asset', label: 'Asset' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'room', label: 'Room' },
  { value: 'floor', label: 'Floor' },
  { value: 'user', label: 'User' },
  { value: 'settings', label: 'Settings' },
  { value: 'export', label: 'Export' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'leave_application', label: 'Leave' },
  { value: 'leave', label: 'Leave' },
  { value: 'laundry_slot', label: 'Laundry' },
  { value: 'meal_feedback', label: 'Meals' },
  { value: 'menu', label: 'Menu' },
  { value: 'auth', label: 'Auth' },
  { value: 'enquiry', label: 'Enquiry' },
];

const ACTION_LABELS: Record<
  string,
  { label: string; variant: 'info' | 'success' | 'danger' | 'warning' | 'neutral' }
> = {
  create: { label: 'Created', variant: 'success' },
  update: { label: 'Updated', variant: 'info' },
  delete: { label: 'Deleted', variant: 'danger' },
  login: { label: 'Login', variant: 'info' },
  logout: { label: 'Logout', variant: 'neutral' },
  payment_verify: { label: 'Payment Verified', variant: 'success' },
  complaint_status_change: { label: 'Complaint Status', variant: 'warning' },
  tenant_checkout: { label: 'Checkout', variant: 'danger' },
  tenant_transfer: { label: 'Transfer', variant: 'warning' },
  settings_change: { label: 'Settings', variant: 'info' },
  notification_send: { label: 'Notification', variant: 'info' },
  visitor_approve: { label: 'Visitor Approved', variant: 'success' },
  export: { label: 'Export', variant: 'neutral' },
  reconcile: { label: 'Reconciled', variant: 'info' },
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);
  const [availableActions, setAvailableActions] = useState<string[]>(DEFAULT_ACTIONS);

  useEffect(() => {
    api
      .get('audit-logs/actions')
      .json<{ success: boolean; data: string[] }>()
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const merged = Array.from(new Set([...DEFAULT_ACTIONS, ...res.data]));
          setAvailableActions(merged);
        }
      })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource', resourceFilter);
      if (userIdFilter.trim()) params.set('userId', userIdFilter.trim());
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`audit-logs?${params.toString()}`).json<{
        success: boolean;
        data: AuditLogRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setLogs(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, actionFilter, resourceFilter, userIdFilter, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '1000');
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource', resourceFilter);
      if (userIdFilter.trim()) params.set('userId', userIdFilter.trim());
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`audit-logs?${params.toString()}`).json<{
        success: boolean;
        data: AuditLogRow[];
      }>();

      const headers = [
        'Timestamp',
        'Action',
        'Resource',
        'Resource ID',
        'User Name',
        'User Email',
        'Role',
        'IP Address',
        'Details JSON',
      ];
      const rows = (res.data || []).map((row) => [
        new Date(row.timestamp).toISOString(),
        row.action,
        row.resource,
        row.resourceId || '',
        row.userId?.name || 'System',
        row.userId?.email || '',
        row.userId?.role || '',
        row.ip || '',
        JSON.stringify(row.details || {}),
      ]);

      // Formula-injection guard (CWE-1236): prefix =, +, -, @, tab, CR cells.
      const sanitizeCell = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
        return `"${str.replace(/"/g, '""')}"`;
      };
      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.map(sanitizeCell).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Best-effort audit log write for the export action
      api.post('audit-logs/log-export', { json: { resource: 'audit_logs' } }).catch(() => {});
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearDates = () => {
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const formatAction = (action: string) => {
    return (
      ACTION_LABELS[action]?.label ??
      action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    );
  };

  const formatActionVariant = (
    action: string,
  ): 'info' | 'success' | 'danger' | 'warning' | 'neutral' => {
    return ACTION_LABELS[action]?.variant ?? 'neutral';
  };

  // Client-side quick filter on current page
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((row) => {
      const resourceMatch = row.resource?.toLowerCase().includes(q);
      const resourceIdMatch = row.resourceId?.toLowerCase().includes(q);
      const userNameMatch = row.userId?.name?.toLowerCase().includes(q);
      const userEmailMatch = row.userId?.email?.toLowerCase().includes(q);
      const ipMatch = row.ip?.toLowerCase().includes(q);
      const actionMatch = row.action?.toLowerCase().includes(q);
      return (
        resourceMatch ||
        resourceIdMatch ||
        userNameMatch ||
        userEmailMatch ||
        ipMatch ||
        actionMatch
      );
    });
  }, [logs, searchQuery]);

  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      header: 'Action',
      accessor: (row) => (
        <StatusBadge variant={formatActionVariant(row.action)} label={formatAction(row.action)} />
      ),
    },
    {
      header: 'Resource',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            {row.resource}
          </span>
          <p className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
            {row.resourceId?.slice(0, 12)}…
          </p>
        </div>
      ),
    },
    {
      header: 'User',
      accessor: (row) => (
        <div>
          <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
            {row.userId?.name ?? 'System'}
          </span>
          <p className="text-xs text-[color:var(--color-text-muted)]">{row.userId?.email ?? '—'}</p>
        </div>
      ),
    },
    {
      header: 'Role',
      accessor: (row) => (
        <span className="text-xs font-semibold text-[color:var(--color-text-secondary)] capitalize">
          {row.userId?.role ?? '—'}
        </span>
      ),
    },
    {
      header: 'Timestamp',
      accessor: (row) => (
        <span className="text-xs whitespace-nowrap text-[color:var(--color-text-secondary)]">
          {new Date(row.timestamp).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: 'IP',
      accessor: (row) => (
        <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
          {row.ip ?? '—'}
        </span>
      ),
    },
    {
      header: '',
      accessor: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(row);
          }}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)]"
          title="Inspect log details"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Details</span>
        </button>
      ),
      className: 'w-[90px] text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Track all admin actions across the system"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-brand-600)]" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          placeholder="Search IP, user, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          aria-label="Search audit logs"
          className="w-full sm:w-[220px]"
        />

        <Select
          options={[
            { value: '', label: 'All Actions' },
            ...availableActions.map((act) => ({
              value: act,
              label: formatAction(act),
            })),
          ]}
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-[190px]"
          aria-label="Filter by action"
        />
        <Select
          options={RESOURCE_OPTIONS}
          value={resourceFilter}
          onChange={(e) => {
            setResourceFilter(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-[190px]"
          aria-label="Filter by resource"
        />
        <Input
          placeholder="Filter by user ID..."
          value={userIdFilter}
          onChange={(e) => {
            setUserIdFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by user ID"
          className="w-full font-mono text-xs sm:w-[200px]"
        />
        <DatePicker
          value={fromDate}
          onChange={(val: string) => {
            setFromDate(val);
            setPage(1);
          }}
          aria-label="From date"
          placeholder="From date..."
          className="w-full sm:w-[150px]"
        />
        <DatePicker
          value={toDate}
          onChange={(val: string) => {
            setToDate(val);
            setPage(1);
          }}
          aria-label="To date"
          placeholder="To date..."
          className="w-full sm:w-[150px]"
        />

        {(fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearDates}
            className="flex items-center gap-1 text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
            title="Reset date bounds"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear Dates</span>
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredLogs}
        keyExtractor={(row: AuditLogRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => setSelectedLog(row)}
        pagination={{
          page,
          perPage,
          total,
          onPageChange: setPage,
          onPerPageChange: (pp) => {
            setPerPage(pp);
            setPage(1);
          },
        }}
        emptyState={
          <EmptyState
            icon={<ScrollText className="h-12 w-12" />}
            title="No audit logs yet"
            description="Audit logs will appear here as actions are performed"
          />
        }
        mobileCardRenderer={(row) => (
          <div className="cursor-pointer space-y-2" onClick={() => setSelectedLog(row)}>
            <div className="flex items-center justify-between">
              <StatusBadge
                variant={formatActionVariant(row.action)}
                label={formatAction(row.action)}
              />
              <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
                {new Date(row.timestamp).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
              <span className="font-semibold text-[color:var(--color-text-primary)]">
                {row.resource}
              </span>
              <span className="font-mono text-[10px]">{row.resourceId?.slice(0, 12)}…</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.userId?.name ?? 'System'}</span>
              <span className="lowercase">{row.userId?.role ?? '—'}</span>
              <span className="font-mono">{row.ip ?? '—'}</span>
            </div>
          </div>
        )}
      />

      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/50 backdrop-blur-sm"
              onClick={() => setSelectedLog(null)}
            />
            <motion.div
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative w-full max-w-lg rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-modal)]"
            >
              <div className="flex items-center justify-between border-b border-b-[color:var(--border-color)] pb-4">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    variant={formatActionVariant(selectedLog.action)}
                    label={formatAction(selectedLog.action)}
                  />
                  <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">
                    Audit Log Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-100)] hover:text-[color:var(--color-text-primary)]"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-[color:var(--color-text-muted)]">User</span>
                    <p className="font-semibold text-[color:var(--color-text-primary)]">
                      {selectedLog.userId?.name ?? 'System'}
                    </p>
                    {selectedLog.userId?.email && (
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {selectedLog.userId.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-[color:var(--color-text-muted)]">Role</span>
                    <p className="font-semibold text-[color:var(--color-text-primary)] capitalize">
                      {selectedLog.userId?.role ?? '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[color:var(--color-text-muted)]">Resource</span>
                    <p className="font-semibold text-[color:var(--color-text-primary)]">
                      {selectedLog.resource}
                    </p>
                    <p className="font-mono text-xs text-[color:var(--color-text-muted)]">
                      ID: {selectedLog.resourceId}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[color:var(--color-text-muted)]">IP Address</span>
                    <p className="font-mono text-xs text-[color:var(--color-text-primary)]">
                      {selectedLog.ip ?? '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-[color:var(--color-text-muted)]">Timestamp</span>
                  <p className="text-xs text-[color:var(--color-text-secondary)]">
                    {new Date(selectedLog.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>

                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <span className="text-xs text-[color:var(--color-text-muted)]">
                      Action Details
                    </span>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-3 font-mono text-xs text-[color:var(--color-text-primary)]">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
