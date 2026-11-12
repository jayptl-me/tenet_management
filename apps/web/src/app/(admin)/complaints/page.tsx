'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { errorMessage } from '@/lib/query';
import { useApiBodyQuery, useApiQuery } from '@/hooks/useApiQuery';
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
import {
  useUrlSearch,
  useUrlState,
  useUrlStateWriter,
  readUrlDateRange,
} from '@/hooks/useUrlState';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { QuickResolveModal, type QuickResolveTarget } from '@/components/admin/QuickResolveModal';
import { toast } from 'sonner';

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

const COMPLAINTS_KEY = ['complaints'] as const;
const COMPLAINTS_STATS_KEY = ['complaints', 'stats'] as const;
// Stable empty fallback: `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for useMemo deps.
const EMPTY_COMPLAINTS: ComplaintRow[] = [];

interface ComplaintsListBody {
  success: boolean;
  data: ComplaintRow[];
  meta: { total: number };
}

const KANBAN_STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'] as const;

const kanbanMeta: Record<string, { label: string; color: string }> = {
  open: {
    label: 'Open',
    color: 'border-l-(--color-brand-500) bg-(--color-brand-50)',
  },
  in_progress: {
    label: 'In Progress',
    color: 'border-l-(--color-warning-500) bg-(--color-warning-50)',
  },
  resolved: {
    label: 'Resolved',
    color: 'border-l-(--color-success-500) bg-(--color-success-50)',
  },
  dismissed: {
    label: 'Dismissed',
    color: 'border-l-(--color-surface-400) bg-(--color-field-bg)',
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

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

/**
 * The values each filter may take in the address bar. A parameter outside the
 * list is ignored, so a broken link leaves the list unfiltered instead of
 * filtering it down to nothing.
 */
const STATUS_FILTERS = STATUS_OPTIONS.map((option) => option.value).filter((v) => v !== '');
const CATEGORY_FILTERS = CATEGORY_OPTIONS.map((option) => option.value).filter((v) => v !== '');
const PRIORITY_FILTERS = PRIORITY_OPTIONS.map((option) => option.value).filter((v) => v !== '');

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
  onQuickResolve,
}: {
  status: string;
  complaints: ComplaintRow[];
  onComplaintClick: (row: ComplaintRow) => void;
  onQuickResolve?: (row: ComplaintRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = kanbanMeta[status] ?? {
    label: status,
    color: 'border-l-(--color-surface-300) bg-(--color-field-bg)',
  };

  return (
    <div
      ref={setNodeRef}
      className={`min-h-50 rounded-(--radius-xl) border border-(--border-color) bg-(--color-card-bg) shadow-(--shadow-card) transition-all duration-(--transition-duration) ${isOver ? 'scale-[1.01] ring-2 ring-(--color-brand-500) ring-offset-2 ring-offset-(--focus-ring-offset-bg)' : ''}`}
    >
      <div
        className={`border-b-[length:var(--bw-strong)] border-b-(--border-color) px-4 py-3 ${meta.color} rounded-t-md`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-(--color-text-primary) capitalize">
            {meta.label}
          </h3>
          <span className="rounded-full bg-(--color-text-primary) px-2 py-0.5 font-mono text-xs font-bold text-(--color-card-bg)">
            {complaints.length}
          </span>
        </div>
      </div>
      <div className="max-h-125 space-y-2 overflow-y-auto p-3">
        {complaints.length === 0 ? (
          <p className="py-6 text-center text-xs text-(--color-text-muted)">No complaints</p>
        ) : (
          complaints.map((complaint) => (
            <KanbanCard
              key={complaint._id}
              complaint={complaint}
              onClick={() => onComplaintClick(complaint)}
              onQuickResolve={onQuickResolve}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  complaint,
  onClick,
  onQuickResolve,
}: {
  complaint: ComplaintRow;
  onClick: () => void;
  onQuickResolve?: (row: ComplaintRow) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: complaint._id,
  });

  const canQuickResolve =
    (complaint.status === 'open' || complaint.status === 'in_progress') && Boolean(onQuickResolve);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`group cursor-grab rounded-md border-[length:var(--bw-default)] border-(--border-color) bg-(--color-card-bg) p-3 shadow-sm transition-all duration-(--transition-duration) hover:border-(--color-brand-500) active:cursor-grabbing ${
        isDragging ? 'opacity-40 shadow-none' : 'hover:shadow-(--shadow-card)'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display line-clamp-2 text-xs font-bold text-(--color-text-primary) group-hover:text-(--color-brand-500)">
          {complaint.title}
        </p>
        <StatusBadge
          variant={statusToVariant(complaint.priority)}
          label={complaint.priority}
          size="xs"
          className="shrink-0"
        />
      </div>
      <div className="text-2xs mt-2 flex items-center justify-between text-(--color-text-muted)">
        <span className="truncate">
          {complaint.tenant?.user?.name ?? 'Unknown'}
          {complaint.tenant?.room?.roomNumber ? ` · R-${complaint.tenant.room.roomNumber}` : ''}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="capitalize">{complaint.category.replace(/_/g, ' ')}</span>
          {canQuickResolve && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickResolve?.(complaint);
              }}
              className="rounded p-0.5 text-(--color-text-muted) transition-colors hover:bg-(--color-success-50) hover:text-(--color-success-600)"
              title="Quick Resolve"
              aria-label="Quick Resolve"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────

function ComplaintsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // The filters live in the address bar: a triage link lands filtered, and the
  // view can be shared, bookmarked and cited.
  const statusState = useUrlState<string>('status', { defaultValue: '', allowed: STATUS_FILTERS });
  const categoryState = useUrlState<string>('category', {
    defaultValue: '',
    allowed: CATEGORY_FILTERS,
  });
  const priorityState = useUrlState<string>('priority', {
    defaultValue: '',
    allowed: PRIORITY_FILTERS,
  });
  const searchState = useUrlSearch('search');
  const { write: writeUrl } = useUrlStateWriter();

  const searchFilter = searchState.value;
  const statusFilter = statusState.value;
  const categoryFilter = categoryState.value;
  const priorityFilter = priorityState.value;

  const urlDates = readUrlDateRange(searchParams);
  const fromDate = urlDates.fromDate;
  const toDate = urlDates.toDate;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isExporting, setIsExporting] = useState(false);
  // Mutation (delete/export/quick-resolve) failures; list failures come from the queries.
  const [error, setError] = useState('');
  // Outcome of the last write, as reported by the server.
  const [writeResult, setWriteResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ComplaintRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [quickResolveTarget, setQuickResolveTarget] = useState<QuickResolveTarget | null>(null);

  const tableParams = new URLSearchParams();
  tableParams.set('page', String(page));
  tableParams.set('limit', String(perPage));
  if (searchFilter.trim()) tableParams.set('search', searchFilter.trim());
  if (statusFilter) tableParams.set('status', statusFilter);
  if (categoryFilter) tableParams.set('category', categoryFilter);
  if (priorityFilter) tableParams.set('priority', priorityFilter);
  if (fromDate) tableParams.set('fromDate', fromDate);
  if (toDate) tableParams.set('toDate', toDate);

  const kanbanParams = new URLSearchParams();
  kanbanParams.set('limit', '200');
  if (searchFilter.trim()) kanbanParams.set('search', searchFilter.trim());
  if (categoryFilter) kanbanParams.set('category', categoryFilter);
  if (priorityFilter) kanbanParams.set('priority', priorityFilter);
  if (fromDate) kanbanParams.set('fromDate', fromDate);
  if (toDate) kanbanParams.set('toDate', toDate);

  const { data: statsBody } = useApiQuery<ComplaintStats>(COMPLAINTS_STATS_KEY, 'complaints/stats');

  const tableQuery = useApiBodyQuery<ComplaintsListBody>(
    [
      ...COMPLAINTS_KEY,
      'table',
      page,
      perPage,
      searchFilter,
      statusFilter,
      categoryFilter,
      priorityFilter,
      fromDate,
      toDate,
    ],
    `complaints?${tableParams.toString()}`,
    { enabled: viewMode === 'table' },
  );

  const kanbanKey = [
    ...COMPLAINTS_KEY,
    'kanban',
    searchFilter,
    categoryFilter,
    priorityFilter,
    fromDate,
    toDate,
  ] as const;

  const kanbanQuery = useApiBodyQuery<ComplaintsListBody>(
    kanbanKey,
    `complaints?${kanbanParams.toString()}`,
    { enabled: viewMode === 'kanban' },
  );

  const activeQuery = viewMode === 'kanban' ? kanbanQuery : tableQuery;
  const complaints = activeQuery.data?.data ?? EMPTY_COMPLAINTS;
  const total = activeQuery.data?.meta.total ?? 0;
  const isLoading = activeQuery.isPending;
  const fetchErrorMessage = errorMessage(activeQuery.error);
  const stats = statsBody ?? null;

  const handleQuickResolve = async (
    id: string,
    status: 'resolved' | 'dismissed',
    adminNotes: string,
  ) => {
    try {
      const res = await api
        .put(`complaints/${id}/status`, {
          json: { status, adminNotes },
        })
        .json<{ success: boolean; data?: { status?: string } }>();
      setQuickResolveTarget(null);
      setError('');
      // Re-read the server: the list, the stat cards and the status badges
      // below then show the server's own state.
      await queryClient.invalidateQueries({ queryKey: COMPLAINTS_KEY });
      const serverStatus = res.data?.status ?? status;
      setWriteResult(
        `Status saved. The server now reports this complaint as "${serverStatus.replace(/_/g, ' ')}".`,
      );
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Real-time SSE listener
  useSSE(
    useCallback(
      (event: string) => {
        if (event === 'new_complaint' || event === 'complaint_updated') {
          void queryClient.invalidateQueries({ queryKey: COMPLAINTS_KEY });
        }
      },
      [queryClient],
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
      setError('');
      void queryClient.invalidateQueries({ queryKey: COMPLAINTS_KEY });
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

  // Mount-stable clock read (react/purity): the fallback must not recompute per render.
  const [fallbackNow] = useState(() => new Date());
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
    return { heatmapYear: fallbackNow.getFullYear(), heatmapMonth: fallbackNow.getMonth() };
  }, [fromDate, toDate, fallbackNow]);

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

    // Optimistic column move on the kanban cache; reverted if the PUT fails.
    queryClient.setQueryData<ComplaintsListBody>(kanbanKey, (old) =>
      old
        ? {
            ...old,
            data: old.data.map((c) => (c._id === complaintId ? { ...c, status: newStatus } : c)),
          }
        : old,
    );

    setIsUpdatingStatus(true);
    try {
      await api
        .put(`complaints/${complaintId}/status`, {
          json: { status: newStatus },
        })
        .json();
      // The optimistic move is provisional: re-read the server so the board
      // shows the status the server actually stored.
      void queryClient.invalidateQueries({ queryKey: COMPLAINTS_KEY });
    } catch {
      queryClient.setQueryData<ComplaintsListBody>(kanbanKey, (old) =>
        old
          ? {
              ...old,
              data: old.data.map((c) =>
                c._id === complaintId ? { ...c, status: complaint.status } : c,
              ),
            }
          : old,
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchFilter || statusFilter || categoryFilter || priorityFilter || fromDate || toDate,
  );

  const handleClearFilters = () => {
    // One write, one address bar: writing the filters one by one would let a
    // later write be built on an address bar that does not carry the earlier one.
    searchState.cancel();
    writeUrl({
      search: null,
      status: null,
      category: null,
      priority: null,
      fromDate: null,
      toDate: null,
      date: null,
    });
    setPage(1);
  };

  const handleStatusCardClick = (statusKey: string) => {
    if (statusFilter === statusKey) {
      statusState.setValue('');
    } else {
      statusState.setValue(statusKey);
      setViewMode('table');
    }
    setPage(1);
  };

  /** Writes the date range into the address bar. `?date=` is the alias it replaces. */
  const handleDateRangeChange = (nextFrom: string, nextTo: string) => {
    writeUrl({ fromDate: nextFrom || null, toDate: nextTo || null, date: null });
  };

  const columns: DataTableColumn<ComplaintRow>[] = [
    {
      header: 'Title',
      accessor: (row) => (
        <span className="font-semibold text-(--color-text-primary)">{row.title}</span>
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
          extra={
            row.status === 'open' || row.status === 'in_progress'
              ? [
                  {
                    label: 'Quick Resolve',
                    icon: <CheckCircle2 className="h-3.5 w-3.5 text-(--color-success-600)" />,
                    onClick: () =>
                      setQuickResolveTarget({
                        _id: row._id,
                        title: row.title,
                        tenantName: row.tenant?.user?.name,
                        roomNumber: row.tenant?.room?.roomNumber,
                        category: row.category,
                        priority: row.priority,
                        status: row.status,
                        adminNotes: row.adminNotes,
                      }),
                  },
                ]
              : undefined
          }
        />
      ),
      className: 'w-40',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaints"
        description="Track and resolve tenant complaints"
        action={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-(--radius-md) border-[length:var(--bw-default)] border-(--border-color)">
              <button
                onClick={() => setViewMode('table')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-(--transition-duration) ${
                  viewMode === 'table'
                    ? 'bg-(--color-text-primary) text-(--color-card-bg)'
                    : 'bg-(--color-field-bg) text-(--color-text-secondary) hover:bg-(--color-surface-100)'
                }`}
                aria-label="Table view mode"
              >
                <LayoutList className="mr-1 inline h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`font-display px-3 py-1.5 text-xs font-semibold transition-colors duration-(--transition-duration) ${
                  viewMode === 'kanban'
                    ? 'bg-(--color-text-primary) text-(--color-card-bg)'
                    : 'bg-(--color-field-bg) text-(--color-text-secondary) hover:bg-(--color-surface-100)'
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

      <ErrorBanner message={fetchErrorMessage || error} />

      {writeResult && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
          {writeResult}
        </div>
      )}

      {/* ── Top KPI StatCards Row ────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Tickets"
          value={stats?.byStatus.open ?? 0}
          icon={<AlertCircle className="h-5 w-5" />}
          variant="warning"
          selected={statusFilter === 'open'}
          onClick={() => handleStatusCardClick('open')}
        />
        <StatCard
          title="In Progress"
          value={stats?.byStatus.in_progress ?? 0}
          icon={<Clock className="h-5 w-5" />}
          variant="brand"
          selected={statusFilter === 'in_progress'}
          onClick={() => handleStatusCardClick('in_progress')}
        />
        <StatCard
          title="Resolved"
          value={stats?.byStatus.resolved ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant="success"
          selected={statusFilter === 'resolved'}
          onClick={() => handleStatusCardClick('resolved')}
        />
        <StatCard
          title="Dismissed"
          value={stats?.byStatus.dismissed ?? 0}
          icon={<MessageSquareWarning className="h-5 w-5" />}
          variant="default"
          selected={statusFilter === 'dismissed'}
          onClick={() => handleStatusCardClick('dismissed')}
        />
      </div>

      {stats && Object.keys(stats.byCategory).length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by category"
        >
          <span className="text-xs font-bold tracking-wider text-(--color-text-muted) uppercase">
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
                    categoryState.setValue(active ? '' : cat);
                    setPage(1);
                  }}
                  className={
                    active
                      ? 'rounded-full border border-(--color-brand-500) bg-(--color-brand-500) px-3 py-1 text-xs font-bold text-(--color-on-brand) shadow-(--shadow-xs)'
                      : 'rounded-full border border-(--border-color) bg-(--color-card-bg) px-3 py-1 text-xs font-semibold text-(--color-text-secondary) hover:border-(--color-brand-300)'
                  }
                >
                  {cat.replace(/_/g, ' ')} · {count}
                </button>
              );
            })}
        </div>
      )}

      {isUpdatingStatus && (
        <div className="flex items-center gap-2 rounded-lg border-[length:var(--bw-strong)] border-(--color-brand-500) bg-(--color-brand-100) p-3 text-sm font-semibold text-(--color-brand-800)">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating complaint status...
        </div>
      )}

      {/* ── Multi-Attribute Filter Bar ──────────────── */}
      <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-55 flex-1">
            <Input
              placeholder="Search title, description, or tenant..."
              value={searchState.text}
              onChange={(e) => {
                searchState.onChange(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="h-4 w-4 text-(--color-text-muted)" />}
              aria-label="Search complaints"
            />
          </div>

          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              statusState.setValue(e.target.value);
              setPage(1);
            }}
            className="sm:w-40"
            aria-label="Filter by status"
          />

          <Select
            options={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={(e) => {
              categoryState.setValue(e.target.value);
              setPage(1);
            }}
            className="sm:w-45"
            aria-label="Filter by category"
          />

          <Select
            options={PRIORITY_OPTIONS}
            value={priorityFilter}
            onChange={(e) => {
              priorityState.setValue(e.target.value);
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
              handleDateRangeChange(value, toDate);
              setPage(1);
            }}
            onToChange={(value) => {
              handleDateRangeChange(fromDate, value);
              setPage(1);
            }}
            className="sm:w-80 sm:shrink-0"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="muted"
            size="sm"
            onClick={handleClearFilters}
            className="self-end sm:self-center"
            aria-label="Clear all active filters"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4 shadow-sm">
        <div className="mb-2">
          <h3 className="font-display text-sm font-bold text-(--color-text-primary)">
            Complaint density
          </h3>
          <p className="text-xs text-(--color-text-muted)">
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
              handleDateRangeChange(date, date);
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
                <span className="max-w-[70%] truncate text-sm font-semibold text-(--color-text-primary)">
                  {row.title}
                </span>
                <StatusBadge
                  variant={statusToVariant(row.status)}
                  label={row.status ? row.status.replace(/_/g, ' ') : 'Unknown'}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-(--color-text-muted)">
                <span>{row.tenant?.user?.name ?? 'N/A'}</span>
                <span className="capitalize">{row.category.replace(/_/g, ' ')}</span>
                <StatusBadge variant={statusToVariant(row.priority)} label={row.priority} />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <TableActions
                  onView={() => router.push(`/complaints/${row._id}`)}
                  onEdit={() => router.push(`/complaints/${row._id}/edit`)}
                  onDelete={() => setDeleteTarget(row)}
                  extra={
                    row.status === 'open' || row.status === 'in_progress'
                      ? [
                          {
                            label: 'Quick Resolve',
                            icon: (
                              <CheckCircle2 className="h-3.5 w-3.5 text-(--color-success-600)" />
                            ),
                            onClick: () =>
                              setQuickResolveTarget({
                                _id: row._id,
                                title: row.title,
                                tenantName: row.tenant?.user?.name,
                                roomNumber: row.tenant?.room?.roomNumber,
                                category: row.category,
                                priority: row.priority,
                                status: row.status,
                                adminNotes: row.adminNotes,
                              }),
                          },
                        ]
                      : undefined
                  }
                />
              </div>
            </div>
          )}
        />
      ) : (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
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
                    onQuickResolve={(row) =>
                      setQuickResolveTarget({
                        _id: row._id,
                        title: row.title,
                        tenantName: row.tenant?.user?.name,
                        roomNumber: row.tenant?.room?.roomNumber,
                        category: row.category,
                        priority: row.priority,
                        status: row.status,
                        adminNotes: row.adminNotes,
                      })
                    }
                  />
                ))}
              </div>
              <DragOverlay>
                {activeComplaint ? (
                  <div className="w-64 rotate-2 rounded-md border-[length:var(--bw-strong)] border-(--border-color) bg-(--color-brand-50) p-3 shadow-(--shadow-card)">
                    <p className="font-display truncate text-sm font-bold text-(--color-text-primary)">
                      {activeComplaint.title}
                    </p>
                    <p className="mt-1 text-xs text-(--color-text-muted)">
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

      <QuickResolveModal
        target={quickResolveTarget}
        onResolve={handleQuickResolve}
        onClose={() => setQuickResolveTarget(null)}
      />
    </div>
  );
}

export default function ComplaintsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <ComplaintsContent />
    </Suspense>
  );
}
