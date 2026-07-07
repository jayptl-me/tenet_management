'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';

interface GuardianRow {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  isEmergencyContact: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function GuardiansPage() {
  const router = useRouter();
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchGuardians = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (search) params.set('search', search);

      const res = await api.get(`guardians?${params.toString()}`).json<{
        success: boolean;
        data: GuardianRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setGuardians(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load guardians');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, search]);

  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  const columns: DataTableColumn<GuardianRow>[] = [
    {
      header: 'Name',
      accessor: (row) => <span className="text-surface-900 font-semibold">{row.name}</span>,
    },
    {
      header: 'Phone',
      accessor: (row) => row.phone,
    },
    {
      header: 'Relation',
      accessor: (row) => <span className="capitalize">{row.relation}</span>,
    },
    {
      header: 'Tenant',
      accessor: (row) => row.tenant?.user?.name ?? 'N/A',
    },
    {
      header: 'Emergency',
      accessor: (row) => (
        <StatusBadge
          variant={row.isEmergencyContact ? 'success' : 'neutral'}
          label={row.isEmergencyContact ? 'Yes' : 'No'}
        />
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusBadge
          variant={statusToVariant(row.isActive ? 'active' : 'inactive')}
          label={row.isActive ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/guardians/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/guardians/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[90px]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Guardians</h2>
          <p className="text-surface-500 mt-0.5 text-sm">
            Manage tenant guardians & emergency contacts
          </p>
        </div>
        <Button onClick={() => router.push('/guardians/new')}>
          <Plus className="h-4 w-4" />
          Add Guardian
        </Button>
      </div>
      {error && (
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>
      <DataTable
        columns={columns}
        data={guardians}
        keyExtractor={(row: GuardianRow) => row._id}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/guardians/${row._id}`)}
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
      />
    </div>
  );
}
