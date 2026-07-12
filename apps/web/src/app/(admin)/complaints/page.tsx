'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, LayoutList, Columns3, Loader2, MessageSquareWarning } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableActions } from '@/components/ui/TableActions';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';

// ── Types ──────────────────────────────────────────────

interface ComplaintRow {
  _id: string;
  tenant?: { user?: { name: string }; room?: { roomNumber: string } };
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  createdAt: string;
}

type ViewMode = 'table' | 'kanban';

const KANBAN_STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'] as const;

const kanbanMeta: Record<string, { label: string; color: string }> = {
  open: {
    label: 'Open',
    color: 'border-l-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)]',
  },
  in_progress: {
    label: 'In Progress',
    color: 'border-l-[color:var(--color-warning-500)] bg-[color:var(--color-warning-50)]',
  },
  resolved: {
    label: 'Resolved',
    color: 'border-l-[color:var(--color-success-500)] bg-[color:var(--color-success-50)]',
  },
  dismissed: {
    label: 'Dismissed',
    color: 'border-l-[color:var(--color-surface-400)] bg-[color:var(--color-field-bg)]',
  },
};

// ── Kanban Sub-Components ───────────────────────────────

function KanbanColumn({
  status,
  complaints,
  onComplaintClick,
}: {
  status: string;
  complaints: ComplaintRow[];
  onComplaintClick: (row: ComplaintRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = kanbanMeta[status] ?? {
    label: status,
    color: 'border-l-[color:var(--color-surface-300)] bg-[color:var(--color-field-bg)]',
  };

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded-[var(--radius-xl)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)] ${isOver ? 'scale-[1.01] ring-2 ring-[color:var(--color-brand-500)] ring-offset-2 ring-offset-[color:var(--focus-ring-offset-bg)]' : ''}`}
    >
      <div
        className={`border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] px-4 py-3 ${meta.color} rounded-t-md`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold capitalize text-[color:var(--color-text-primary)]">
            {meta.label}
          </h3>
          <span className="rounded-full bg-[color:var(--color-text-primary)] px-2 py-0.5 font-mono text-xs font-bold text-[color:var(--color-card-bg)]">
            {complaints.length}
          </span>
        </div>
      </div>
      <div className="max-h-[500px] space-y-2 overflow-y-auto p-3">
        {complaints.length === 0 ? (
          <p className="py-6 text-center text-xs text-[color:var(--color-text-muted)]">
            No complaints
          </p>
        ) : (
          complaints.map((c) => (
            <KanbanCard key={c._id} complaint={c} onClick={() => onComplaintClick(c)} />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({ complaint, onClick }: { complaint: ComplaintRow; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: complaint._id,
    data: { status: complaint.status },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 20 }
    : undefined;

  const priorityVariant =
    complaint.priority === 'urgent'
      ? 'danger'
      : complaint.priority === 'high'
        ? 'warning'
        : 'info';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      className={`cursor-grab rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-3 shadow-[var(--shadow-button)] transition-all hover:shadow-[var(--shadow-card)] active:cursor-grabbing ${isDragging ? 'rotate-1 opacity-50' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-display flex-1 truncate text-sm font-bold text-[color:var(--color-text-primary)]">
          {complaint.title}
        </p>
        <StatusBadge variant={priorityVariant} label={complaint.priority} />
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-[color:var(--color-text-muted)]">
        {complaint.description}
      </p>
      <div className="flex items-center justify-between text-[10px] text-[color:var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span>{complaint.tenant?.user?.name ?? 'N/A'}</span>
          {complaint.tenant?.room?.roomNumber && (
            <span>• Rm {complaint.tenant.room.roomNumber}</span>
          )}
        </span>
        <span>
          {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function ComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ComplaintRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (statusFilter && viewMode === 'table') params.set('status', statusFilter);

      const res = await api.get(`complaints?${params.toString()}`).json<{
        success: boolean;
        data: ComplaintRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setComplaints(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, statusFilter, viewMode]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Kanban: load all complaints (no pagination)
  const fetchAllForKanban = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      const res = await api.get(`complaints?${params.toString()}`).json<{
        success: boolean;
        data: ComplaintRow[];
        meta: { total: number };
      }>();
      setComplaints(res.data);
      setTotal(res.meta.total);
    } catch {
      setError('Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'kanban') {
      fetchAllForKanban();
    } else {
      fetchComplaints();
    }
  }, [viewMode, fetchAllForKanban, fetchComplaints]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`complaints/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      if (viewMode === 'kanban') {
        fetchAllForKanban();
      } else {
        fetchComplaints();
      }
    } catch {
      setError('Failed to delete complaint');
    } finally {
      setDeleting(false);
    }
  };

  const kanbanColumns = useMemo(() => {
    const grouped: Record<string, ComplaintRow[]> = {};
    for (const status of KANBAN_STATUSES) {
      grouped[status] = complaints.filter((c) => c.status === status);
    }
    return grouped;
  }, [complaints]);

  const activeComplaint = useMemo(
    () => complaints.find((c) => c._id === activeDragId) ?? null,
    [complaints, activeDragId],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const complaintId = String(active.id);
    const newStatus = String(over.id);

    if (!KANBAN_STATUSES.includes(newStatus as (typeof KANBAN_STATUSES)[number])) return;

    const complaint = complaints.find((c) => c._id === complaintId);
    if (!complaint || complaint.status === newStatus) return;

    setComplaints((prev) =>
      prev.map((c) => (c._id === complaintId ? { ...c, status: newStatus } : c)),
    );

    setIsUpdatingStatus(true);
    try {
      await api
        .put(`complaints/${complaintId}/status`, {
          json: { status: newStatus },
        })
        .json();
    } catch {
      setComplaints((prev) =>
        prev.map((c) => (c._id === complaintId ? { ...c, status: complaint.status } : c)),
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const columns: DataTableColumn<ComplaintRow>[] = [
    {
      header: 'Title',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">{row.title}</span>
      ),
    },
    {
      header: 'Tenant',
      accessor: (row) => row.tenant?.user?.name ?? 'N/A',
    },
    {
      header: 'Category',
      accessor: (row) => <span className="capitalize">{row.category}</span>,
    },
    {
      header: 'Severity',
      accessor: (row) => (
        <StatusBadge
          variant={
            row.priority === 'urgent' ? 'danger' : row.priority === 'high' ? 'warning' : 'info'
          }
          label={row.priority}
        />
      ),
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
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/complaints/${row._id}`)}
          onEdit={() => router.push(`/complaints/${row._id}/edit`)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaints"
        description="Track and resolve tenant complaints"
        action={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-[var(--radius-md)] border-[length:var(--bw-default)] border-[color:var(--border-color)]">
              <button
                onClick={() => setViewMode('table')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--transition-duration)] ${
                  viewMode === 'table'
                    ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-card-bg)]'
                    : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
                }`}
              >
                <LayoutList className="mr-1 inline h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--transition-duration)] ${
                  viewMode === 'kanban'
                    ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-card-bg)]'
                    : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
                }`}
              >
                <Columns3 className="mr-1 inline h-3.5 w-3.5" />
                Kanban
              </button>
            </div>
            <Button onClick={() => router.push('/complaints/new')}>
              <Plus className="h-4 w-4" />
              New Complaint
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}
      {isUpdatingStatus && (
        <div className="flex items-center gap-2 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-100)] p-3 text-sm font-semibold text-[color:var(--color-brand-800)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating complaint status...
        </div>
      )}

      {viewMode === 'table' ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'dismissed', label: 'Dismissed' },
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
            data={complaints}
            keyExtractor={(row: ComplaintRow) => row._id}
            isLoading={isLoading}
            onRowClick={(row) => router.push(`/complaints/${row._id}`)}
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
                icon={<MessageSquareWarning className="h-12 w-12" />}
                title="No complaints yet"
                description="File your first complaint to get started"
                action={{ label: 'New Complaint', onClick: () => router.push('/complaints/new') }}
              />
            }
            mobileCardRenderer={(row) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="max-w-[70%] truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                    {row.title}
                  </span>
                  <StatusBadge
                    variant={statusToVariant(row.status)}
                    label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
                  <span>{row.tenant?.user?.name ?? 'N/A'}</span>
                  <StatusBadge
                    variant={
                      row.priority === 'urgent'
                        ? 'danger'
                        : row.priority === 'high'
                          ? 'warning'
                          : 'info'
                    }
                    label={row.priority}
                  />
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <TableActions
                    onView={() => router.push(`/complaints/${row._id}`)}
                    onEdit={() => router.push(`/complaints/${row._id}/edit`)}
                    onDelete={() => setDeleteTarget(row)}
                  />
                </div>
              </div>
            )}
          />
        </>
      ) : (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)] border-t-[color:var(--color-brand-500)]" />
            </div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {KANBAN_STATUSES.map((status) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    complaints={kanbanColumns[status] ?? []}
                    onComplaintClick={(row) => router.push(`/complaints/${row._id}`)}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeComplaint ? (
                  <div className="w-64 rotate-2 rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-brand-50)] p-3 shadow-[var(--shadow-card)]">
                    <p className="font-display truncate text-sm font-bold text-[color:var(--color-text-primary)]">
                      {activeComplaint.title}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                      {activeComplaint.tenant?.user?.name ?? 'N/A'}
                    </p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Complaint"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
