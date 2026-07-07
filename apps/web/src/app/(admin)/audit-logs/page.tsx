'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Search, Calendar, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
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
          <span className="text-surface-900 font-semibold">{row.resource}</span>
          <p className="text-surface-400 font-mono text-[10px]">{row.resourceId?.slice(0, 12)}…</p>
        </div>
      ),
    },
    {
      header: 'User',
      accessor: (row) => (
        <div>
          <span className="text-surface-800 text-sm font-semibold">
            {row.userId?.name ?? 'System'}
          </span>
          <p className="text-surface-400 text-xs">{row.userId?.email ?? '—'}</p>
        </div>
      ),
    },
    {
      header: 'Role',
      accessor: (row) => (
        <span className="text-surface-600 text-xs font-semibold capitalize">
          {row.userId?.role ?? '—'}
        </span>
      ),
    },
    {
      header: 'Timestamp',
      accessor: (row) => (
        <span className="text-surface-600 text-xs whitespace-nowrap">
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
        <span className="text-surface-400 font-mono text-[11px]">{row.ip ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="bg-surface-100 rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)] p-2">
            <Shield className="text-surface-600 h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">Audit Logs</h2>
            <p className="text-surface-500 mt-0.5 text-sm">
              Track all admin actions across the system
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}

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
      />
    </div>
  );
}
