'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Eye, Pencil, LayoutList, Columns3, Loader2, Trash2, MessageSquareWarning } from 'lucide-react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
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
  severity: string;
  status: string;
  category: string;
  createdAt: string;
}

type ViewMode = 'table' | 'kanban';

const KANBAN_STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'] as const;

const kanbanMeta: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'border-l-brand-500 bg-brand-50' },
  in_progress: { label: 'In Progress', color: 'border-l-warning-500 bg-warning-50' },
  resolved: { label: 'Resolved', color: 'border-l-success-500 bg-success-50' },
  dismissed: { label: 'Dismissed', color: 'border-l-surface-400 bg-surface-50' },
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
  const meta = kanbanMeta[status] ?? { label: status, color: 'border-l-surface-300 bg-surface-50' };

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] shadow-[var(--shadow-card)] transition-all duration-[var(--transition-duration)] ${isOver ? 'ring-[length:var(--bw-strong)] ring-[color:var(--color-brand-500)] ring-offset-2 scale-[1.01]' : ''}`}
    >
      <div
        className={`border-b-[length:var(--bw-strong)] border-b-[color:var(--border-color)] px-4 py-3 ${meta.color} rounded-t-md`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-surface-900 text-sm font-bold capitalize">
            {meta.label}
          </h3>
          <span className="bg-surface-900 rounded-full px-2 py-0.5 font-mono text-xs font-bold text-[color:var(--color-surface-50)]">
            {complaints.length}
          </span>
        </div>
      </div>
      <div className="max-h-[500px] space-y-2 overflow-y-auto p-3">
        {complaints.length === 0 ? (
          <p className="text-surface-400 py-6 text-center text-xs">No complaints</p>
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
    complaint.severity === 'critical'
      ? 'danger'
      : complaint.severity === 'high'
        ? 'warning'
        : 'info';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      className={`bg-surface-50 cursor-grab rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-3 shadow-[var(--shadow-button)] transition-all hover:shadow-[var(--shadow-card)] active:cursor-grabbing ${isDragging ? 'rotate-1 opacity-50' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-display text-surface-900 flex-1 truncate text-sm font-bold">
          {complaint.title}
        </p>
        <StatusBadge variant={priorityVariant} label={complaint.severity} />
      </div>
      <p className="text-surface-500 mb-2 line-clamp-2 text-xs">{complaint.description}</p>
      <div className="text-surface-400 flex items-center justify-between text-[10px]">
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

    // Only handle drops onto columns (KANBAN_STATUSES)
    if (!KANBAN_STATUSES.includes(newStatus as (typeof KANBAN_STATUSES)[number])) return;

    const complaint = complaints.find((c) => c._id === complaintId);
    if (!complaint || complaint.status === newStatus) return;

    // Optimistic update
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
      // Revert on failure
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
      accessor: (row) => <span className="text-surface-900 font-semibold">{row.title}</span>,
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
            row.severity === 'critical' ? 'danger' : row.severity === 'high' ? 'warning' : 'info'
          }
          label={row.severity}
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
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/complaints/${row._id}`);
            }}
            className="text-surface-700 hover:bg-surface-100 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="View"
          >
            <Eye className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/complaints/${row._id}/edit`);
            }}
            className="text-brand-600 hover:bg-brand-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            className="text-danger-600 hover:bg-danger-50 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
      className: 'w-[130px]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-surface-900 text-2xl font-extrabold">Complaints</h2>
          <p className="text-surface-500 mt-0.5 text-sm">Track and resolve tenant complaints</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)]">
            <button
              onClick={() => setViewMode('table')}
              className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--transition-duration)] ${
                viewMode === 'table'
                  ? 'bg-surface-900 text-white'
                  : 'text-surface-600 hover:bg-surface-100 bg-[color:var(--color-surface-100)]'
              }`}
            >
              <LayoutList className="mr-1 inline h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--transition-duration)] ${
                viewMode === 'kanban'
                  ? 'bg-surface-900 text-white'
                  : 'text-surface-600 hover:bg-surface-100 bg-[color:var(--color-surface-100)]'
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
      </div>

      {error && <ErrorBanner message={error} />}
      {isUpdatingStatus && (
        <div className="border-brand-500 bg-brand-100 text-brand-800 flex items-center gap-2 rounded-lg border-[length:var(--bw-strong)] p-3 text-sm font-semibold">
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
                  <span className="font-semibold text-[color:var(--color-text-primary)] text-sm truncate max-w-[70%]">
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
                      row.severity === 'critical' ? 'danger' : row.severity === 'high' ? 'warning' : 'info'
                    }
                    label={row.severity}
                  />
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/complaints/${row._id}`);
                    }}
                    className="text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-200)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
                    title="View"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/complaints/${row._id}/edit`);
                    }}
                    className="text-[color:var(--color-brand-600)] hover:bg-[color:var(--color-brand-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(row);
                    }}
                    className="text-[color:var(--color-danger-600)] hover:bg-[color:var(--color-danger-50)] inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-2 py-1 text-xs font-semibold transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          />
        </>
      ) : (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
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
                  <div className="bg-brand-50 w-64 rotate-2 rounded-md border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-3 shadow-[var(--shadow-card)]">
                    <p className="font-display text-surface-900 truncate text-sm font-bold">
                      {activeComplaint.title}
                    </p>
                    <p className="text-surface-400 mt-1 text-xs">
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
