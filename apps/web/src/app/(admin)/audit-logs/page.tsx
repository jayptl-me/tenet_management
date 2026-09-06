'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { modalContent } from '@/lib/animations';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
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
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
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
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`audit-logs?${params.toString()}`).json<{
        success: boolean;
        data: AuditLogRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setLogs(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, actionFilter, resourceFilter, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
      <PageHeader title="Audit Logs" description="Track all admin actions across the system" />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
          className="max-w-[200px]"
        />
        <Select
          options={[
            { value: '', label: 'All Resources' },
            { value: 'tenant', label: 'Tenant' },
            { value: 'payment', label: 'Payment' },
            { value: 'invoice', label: 'Invoice' },
            { value: 'complaint', label: 'Complaint' },
            { value: 'room', label: 'Room' },
            { value: 'floor', label: 'Floor' },
            { value: 'user', label: 'User' },
            { value: 'settings', label: 'Settings' },
            { value: 'notification', label: 'Notification' },
            { value: 'visitor', label: 'Visitor' },
            { value: 'asset', label: 'Asset' },
            { value: 'guardian', label: 'Guardian' },
          ]}
          value={resourceFilter}
          onChange={(e) => {
            setResourceFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          aria-label="From date"
          className="max-w-[160px] rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-brand-500)]"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          aria-label="To date"
          className="max-w-[160px] rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-brand-500)]"
        />
      </div>

      <DataTable
        columns={columns}
        data={logs}
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
          <div
            className="space-y-2 cursor-pointer"
            onClick={() => setSelectedLog(row)}
          >
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
              className="relative w-full max-w-lg rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-0)] p-6 shadow-[var(--shadow-modal)]"
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
                    <span className="text-xs text-[color:var(--color-text-muted)]">Action Details</span>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-[var(--radius-md)] border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-3 text-xs font-mono text-[color:var(--color-text-primary)]">
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
