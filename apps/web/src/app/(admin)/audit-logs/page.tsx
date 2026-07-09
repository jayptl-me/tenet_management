'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
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

const ACTION_LABELS: Record<string, { label: string; variant: 'info' | 'success' | 'danger' | 'warning' | 'neutral' }> = {
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
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (actionFilter) params.set('action', actionFilter);
      if (resourceFilter) params.set('resource', resourceFilter);

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
  }, [page, perPage, actionFilter, resourceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatAction = (action: string) => {
    return ACTION_LABELS[action]?.label ?? action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatActionVariant = (action: string): 'info' | 'success' | 'danger' | 'warning' | 'neutral' => {
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
          <span className="font-semibold text-[color:var(--color-text-primary)]">{row.resource}</span>
          <p className="font-mono text-[10px] text-[color:var(--color-text-muted)]">{row.resourceId?.slice(0, 12)}…</p>
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
        <span className="text-xs font-semibold capitalize text-[color:var(--color-text-secondary)]">
          {row.userId?.role ?? '—'}
        </span>
      ),
    },
    {
      header: 'Timestamp',
      accessor: (row) => (
        <span className="whitespace-nowrap text-xs text-[color:var(--color-text-secondary)]">
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
        <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">{row.ip ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Track all admin actions across the system"
      />

      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Actions' },
            { value: 'create', label: 'Created' },
            { value: 'update', label: 'Updated' },
            { value: 'delete', label: 'Deleted' },
            { value: 'login', label: 'Login' },
            { value: 'logout', label: 'Logout' },
            { value: 'payment_verify', label: 'Payment Verified' },
            { value: 'complaint_status_change', label: 'Complaint Status' },
            { value: 'tenant_checkout', label: 'Checkout' },
            { value: 'settings_change', label: 'Settings' },
            { value: 'notification_send', label: 'Notification' },
            { value: 'export', label: 'Export' },
          ]}
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
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
          onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
          className="max-w-[200px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={logs}
        keyExtractor={(row: AuditLogRow) => row._id}
        isLoading={isLoading}
        pagination={{
          page,
          perPage,
          total,
          onPageChange: setPage,
          onPerPageChange: (pp) => { setPerPage(pp); setPage(1); },
        }}
        emptyState={
          <EmptyState
            icon={<ScrollText className="h-12 w-12" />}
            title="No audit logs yet"
            description="Audit logs will appear here as actions are performed"
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <StatusBadge variant={formatActionVariant(row.action)} label={formatAction(row.action)} />
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
              <span className="font-semibold text-[color:var(--color-text-primary)]">{row.resource}</span>
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
    </div>
  );
}
