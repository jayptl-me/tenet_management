'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquareMore } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface EnquiryRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  status: string;
  source: string;
  createdAt: string;
}

export default function EnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EnquiryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEnquiries = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`enquiries?${params.toString()}`).json<{
        success: boolean;
        data: EnquiryRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setEnquiries(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load enquiries');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`enquiries/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchEnquiries();
    } catch {
      setError('Failed to delete enquiry');
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<EnquiryRow>[] = [
    {
      header: 'Name',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.name}</span>
      ),
    },
    {
      header: 'Phone',
      accessor: (row) => row.phone,
    },
    {
      header: 'Email',
      accessor: (row) => row.email ?? '—',
    },
    {
      header: 'Source',
      accessor: (row) => <span className="capitalize">{row.source}</span>,
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.status)}
          label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
        />
      ),
    },
    {
      header: 'Date',
      accessor: (row) =>
        new Date(row.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/enquiries/${row._id}`)}
          onEdit={() => router.push(`/enquiries/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        description="Manage prospective tenant enquiries"
        action={
          <Button onClick={() => router.push('/enquiries/new')}>
            <Plus className="h-4 w-4" />
            New Enquiry
          </Button>
        }
      />

      <ErrorBanner message={error} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'new', label: 'New' },
            { value: 'contacted', label: 'Contacted' },
            { value: 'follow_up', label: 'Follow Up' },
            { value: 'converted', label: 'Converted' },
            { value: 'closed', label: 'Closed' },
          ]}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="max-w-[200px]"
        />
      </div>
      <DataTable
        columns={columns}
        data={enquiries}
        keyExtractor={(row: EnquiryRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/enquiries/${row._id}`)}
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
            icon={<MessageSquareMore className="h-12 w-12" />}
            title="No enquiries yet"
            description="When people reach out, you'll see them here"
            action={{ label: 'New Enquiry', onClick: () => router.push('/enquiries/new') }}
          />
        }
        mobileCardRenderer={(row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {row.name}
              </span>
              <StatusBadge
                variant={statusToVariant(row.status)}
                label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
              <span>{row.phone}</span>
              <span className="capitalize">{row.source}</span>
              <span>
                {new Date(row.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-1">
              <TableActions
                onView={() => router.push(`/enquiries/${row._id}`)}
                onEdit={() => router.push(`/enquiries/${row._id}/edit`)}
                showDelete={false}
              />
            </div>
          </div>
        )}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Enquiry"
        message={`Are you sure you want to delete enquiry from "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
