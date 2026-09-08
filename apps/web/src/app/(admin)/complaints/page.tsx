'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  LayoutList,
  Columns3,
  Loader2,
  MessageSquareWarning,
  Download,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableActions } from '@/components/ui/TableActions';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeatmapCalendar } from '@/components/ui/HeatmapCalendar';
import { useSSE } from '@/hooks/useSSE';
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
  tenant?: {
    user?: { name: string };
    bedId?: string | null;
    room?: { roomNumber: string; floor?: { label?: string } | null };
  };
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  adminNotes?: string;
  resolvedAt?: string | null;
  createdAt: string;
}

interface ComplaintStats {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
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

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'cleaning_room', label: 'Cleaning (Room)' },
  { value: 'cleaning_washroom', label: 'Cleaning (Washroom)' },
  { value: 'washing_machine', label: 'Washing Machine' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'lights', label: 'Lights' },
  { value: 'noise', label: 'Noise' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

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
          <h3 className="font-display text-sm font-bold text-[color:var(--color-text-primary)] capitalize">
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
          complaints.map((complaint) => (
            <KanbanCard
              key={complaint._id}
              complaint={complaint}
              onClick={() => onComplaintClick(complaint)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({ complaint, onClick }: { complaint: ComplaintRow; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: complaint._id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`group cursor-grab rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-3 shadow-sm transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-brand-500)] active:cursor-grabbing ${
        isDragging ? 'opacity-40 shadow-none' : 'hover:shadow-[var(--shadow-card)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display line-clamp-2 text-xs font-bold text-[color:var(--color-text-primary)] group-hover:text-[color:var(--color-brand-500)]">
          {complaint.title}
        </p>
        <StatusBadge
          variant={statusToVariant(complaint.priority)}
          label={complaint.priority}
          className="shrink-0 text-[10px]"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--color-text-muted)]">
        <span className="truncate">{complaint.tenant?.user?.name ?? 'Unknown'}</span>
        <span className="capitalize">{complaint.category.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────

export default function ComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [stats, setStats] = useState<ComplaintStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ComplaintRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('complaints/stats').json<{
        success: boolean;
        data: ComplaintStats;
      }>();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch {
      // Non-blocking for stats failure
    }
  }, []);

  const fetchComplaints = useCallback(async () => {
    if (viewMode === 'kanban') return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(perPage));
      if (searchFilter.trim()) params.set('search', searchFilter.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`complaints?${params.toString()}`).json<{
        success: boolean;
        data: ComplaintRow[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>();
      setComplaints(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    perPage,
    searchFilter,
    statusFilter,
    categoryFilter,
    priorityFilter,
    fromDate,
    toDate,
    viewMode,
  ]);

  const fetchAllForKanban = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (searchFilter.trim()) params.set('search', searchFilter.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await api.get(`complaints?${params.toString()}`).json<{
        success: boolean;
        data: ComplaintRow[];
        meta: { total: number };
      }>();
      setComplaints(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
    }
  }, [searchFilter, categoryFilter, priorityFilter, fromDate, toDate]);

  useEffect(() => {
    try {
      const qp = new URLSearchParams(window.location.search);
      const dateParam = qp.get('date') ?? '';
      const fromParam = qp.get('fromDate') ?? '';
      const toParam = qp.get('toDate') ?? '';
      const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
      if (isDate(dateParam)) {
        setFromDate(dateParam);
        setToDate(dateParam);
      } else {
        if (isDate(fromParam)) {
          setFromDate(fromParam);
          setToDate(isDate(toParam) ? toParam : fromParam);
        } else if (isDate(toParam)) {
          setToDate(toParam);
        }
      }
    } catch {
      // Non-browser or malformed query: ignore deep link
    }
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (viewMode === 'kanban') {
      fetchAllForKanban();
    } else {
      fetchComplaints();
    }
  }, [viewMode, fetchAllForKanban, fetchComplaints]);

  // Real-time SSE listener
  useSSE(
    useCallback(
      (event: string) => {
        if (event === 'new_complaint' || event === 'complaint_updated') {
          fetchStats();
          if (viewMode === 'kanban') {
            fetchAllForKanban();
          } else {
            fetchComplaints();
          }
        }
      },
      [fetchStats, viewMode, fetchAllForKanban, fetchComplaints],
    ),
  );

  const handleExportCSV = async () => {
    setIsExporting(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (searchFilter.trim()) params.set('search', searchFilter.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const res = await api.get(`complaints?${params.toString()}`).json<{
        success: boolean;
        data: ComplaintRow[];
      }>();

      const rows = res.data ?? [];
      const headers = [
        'ID',
        'Title',
        'Tenant',
        'Room',
        'Bed',
        'Floor',
        'Category',
        'Priority',
        'Status',
        'Admin Notes',
        'Created At',
        'Resolved At',
      ];

      const csvLines = [
        headers.map(sanitizeCSVValue).join(','),
        ...rows.map((row) =>
          [
            row._id,
            row.title,
            row.tenant?.user?.name ?? '',
            row.tenant?.room?.roomNumber ?? '',
            row.tenant?.bedId ?? '',
            row.tenant?.room?.floor?.label ?? '',
            row.category,
            row.priority,
            row.status,
            row.adminNotes ?? '',
            row.createdAt,
            row.resolvedAt ?? '',
          ]
            .map(sanitizeCSVValue)
            .join(','),
        ),
      ];

      const csvContent = csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `complaints-export-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`complaints/${deleteTarget._id}`).json();
      setDeleteTarget(null);
      fetchStats();
      if (viewMode === 'kanban') {
        fetchAllForKanban();
      } else {
        fetchComplaints();
      }
    } catch (err) {
      setError((await parseApiError(err)).message);
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

  const complaintDensity = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const complaint of complaints) {
      if (!complaint.createdAt) continue;
      const filed = new Date(complaint.createdAt);
      if (Number.isNaN(filed.getTime())) continue;
      const key = `${filed.getFullYear()}-${String(filed.getMonth() + 1).padStart(2, '0')}-${String(filed.getDate()).padStart(2, '0')}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [complaints]);

  const { heatmapYear, heatmapMonth } = useMemo(() => {
    const focus = /^\d{4}-\d{2}-\d{2}$/.test(fromDate)
      ? fromDate
      : /^\d{4}-\d{2}-\d{2}$/.test(toDate)
        ? toDate
        : '';
    if (focus) {
      const parsedYear = Number(focus.slice(0, 4));
      const parsedMonth = Number(focus.slice(5, 7)) - 1;
      if (!Number.isNaN(parsedYear) && parsedMonth >= 0 && parsedMonth <= 11) {
        return { heatmapYear: parsedYear, heatmapMonth: parsedMonth };
      }
    }
    const now = new Date();
    return { heatmapYear: now.getFullYear(), heatmapMonth: now.getMonth() };
  }, [fromDate, toDate]);

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
      fetchStats();
    } catch {
      setComplaints((prev) =>
        prev.map((c) => (c._id === complaintId ? { ...c, status: complaint.status } : c)),
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchFilter || statusFilter || categoryFilter || priorityFilter || fromDate || toDate,
  );

  const handleClearFilters = () => {
    setSearchFilter('');
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleStatusCardClick = (statusKey: string) => {
    if (statusFilter === statusKey) {
      setStatusFilter('');
    } else {
      setStatusFilter(statusKey);
      setViewMode('table');
    }
    setPage(1);
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
      header: 'Room',
      accessor: (row) =>
        row.tenant?.room?.roomNumber
          ? `${row.tenant.room.roomNumber}${row.tenant.bedId ? ` · Bed ${row.tenant.bedId}` : ''}`
          : 'N/A',
    },
    {
      header: 'Category',
      accessor: (row) => <span className="capitalize">{row.category.replace(/_/g, ' ')}</span>,
    },
    {
      header: 'Severity',
      accessor: (row) => (
        <StatusBadge variant={statusToVariant(row.priority)} label={row.priority} />
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
                aria-label="Table view mode"
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
                aria-label="Kanban view mode"
              >
                <Columns3 className="mr-1 inline h-3.5 w-3.5" />
                Kanban
              </button>
            </div>

            <Button
              variant="outline"
              onClick={handleExportCSV}
              loading={isExporting}
              aria-label="Export complaints as CSV"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>

            <Button
              onClick={() => router.push('/complaints/new')}
              aria-label="Create new complaint"
            >
              <Plus className="h-4 w-4" />
              New Complaint
            </Button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* ── Top KPI StatCards Row ────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Tickets"
          value={stats?.byStatus.open ?? 0}
          icon={<AlertCircle className="h-5 w-5" />}
          variant="warning"
          className={`cursor-pointer transition-all ${
            statusFilter === 'open' ? 'ring-2 ring-[color:var(--color-warning-500)]' : ''
          }`}
          onClick={() => handleStatusCardClick('open')}
        />
        <StatCard
          title="In Progress"
          value={stats?.byStatus.in_progress ?? 0}
          icon={<Clock className="h-5 w-5" />}
          variant="brand"
          className={`cursor-pointer transition-all ${
            statusFilter === 'in_progress' ? 'ring-2 ring-[color:var(--color-brand-500)]' : ''
          }`}
          onClick={() => handleStatusCardClick('in_progress')}
        />
        <StatCard
          title="Resolved"
          value={stats?.byStatus.resolved ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="success"
          className={`cursor-pointer transition-all ${
            statusFilter === 'resolved' ? 'ring-2 ring-[color:var(--color-success-500)]' : ''
          }`}
          onClick={() => handleStatusCardClick('resolved')}
        />
        <StatCard
          title="Dismissed"
          value={stats?.byStatus.dismissed ?? 0}
          icon={<MessageSquareWarning className="h-5 w-5" />}
          variant="default"
          className={`cursor-pointer transition-all ${
            statusFilter === 'dismissed' ? 'ring-2 ring-[color:var(--color-text-primary)]' : ''
          }`}
          onClick={() => handleStatusCardClick('dismissed')}
        />
      </div>

      {stats && Object.keys(stats.byCategory).length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by category"
        >
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-text-muted)] uppercase">
            By category:
          </span>
          {Object.entries(stats.byCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([cat, count]) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCategoryFilter(active ? '' : cat);
                    setPage(1);
                  }}
                  className={
                    active
                      ? 'rounded-full border border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-500)] px-3 py-1 text-xs font-bold text-white shadow-[var(--shadow-xs)]'
                      : 'rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-brand-300)]'
                  }
                >
                  {cat.replace(/_/g, ' ')} · {count}
                </button>
              );
            })}
        </div>
      )}

      {isUpdatingStatus && (
        <div className="flex items-center gap-2 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-100)] p-3 text-sm font-semibold text-[color:var(--color-brand-800)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating complaint status...
        </div>
      )}

      {/* ── Multi-Attribute Filter Bar ──────────────── */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-[220px] flex-1">
            <Input
              placeholder="Search title, description, or tenant..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4 text-[color:var(--color-text-muted)]" />}
              aria-label="Search complaints"
            />
          </div>

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
            className="sm:w-[160px]"
            aria-label="Filter by status"
          />

          <Select
            options={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="sm:w-[180px]"
            aria-label="Filter by category"
          />

          <Select
            options={PRIORITY_OPTIONS}
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="sm:w-[150px]"
            aria-label="Filter by priority"
          />
          <DateRangePicker
            compact
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={(value) => {
              setFromDate(value);
              setPage(1);
            }}
            onToChange={(value) => {
              setToDate(value);
              setPage(1);
            }}
            className="sm:w-[320px] sm:shrink-0"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="self-end text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)] sm:self-center"
            aria-label="Clear all active filters"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-4 shadow-sm">
        <div className="mb-2">
          <h3 className="font-display text-sm font-bold text-[color:var(--color-text-primary)]">
            Complaint density
          </h3>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Filings per day from the loaded results. Select a day to filter the list.
          </p>
        </div>
        <div className="flex justify-center">
          <HeatmapCalendar
            data={complaintDensity}
            year={heatmapYear}
            month={heatmapMonth}
            colorScale="danger"
            size={14}
            onDayClick={(date) => {
              setFromDate(date);
              setToDate(date);
              setPage(1);
            }}
          />
        </div>
      </div>

      {viewMode === 'table' ? (
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
              title="No complaints found"
              description={
                hasActiveFilters
                  ? 'No complaints match the selected filters. Try clearing filters.'
                  : 'File your first complaint to get started'
              }
              action={
                hasActiveFilters
                  ? { label: 'Reset Filters', onClick: handleClearFilters }
                  : { label: 'New Complaint', onClick: () => router.push('/complaints/new') }
              }
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
                <span className="capitalize">{row.category.replace(/_/g, ' ')}</span>
                <StatusBadge variant={statusToVariant(row.priority)} label={row.priority} />
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
