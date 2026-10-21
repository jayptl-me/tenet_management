'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  PhoneCall,
  Plus,
  RotateCw,
  Users,
  UtensilsCrossed,
  Wifi,
} from 'lucide-react';
import { clsx } from 'clsx';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useSSE } from '@/hooks/useSSE';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageBand, type PageBandMetric } from '@/components/ui/PageBand';
import { Surface } from '@/components/ui/Surface';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LineChart } from '@/components/ui/LineChart';
import { GaugeChart } from '@/components/ui/GaugeChart';
import { Timeline } from '@/components/ui/Timeline';
import { HeatmapCalendar } from '@/components/ui/HeatmapCalendar';
import { RoomBedHeatmap, type RoomBedMatrixItem } from '@/components/ui/RoomBedHeatmap';
import { ComplaintResolutionHub } from '@/components/ui/ComplaintResolutionHub';
import { ComplaintCategoryMatrix } from '@/components/ui/ComplaintCategoryMatrix';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { chartTokens } from '@/lib/chart-theme';
import { surfaceNestedClass } from '@/lib/field-styles';
import type { IComplaintSlaMetrics } from '@pg/types';

// ── Types ───────────────────────────────────────────────────────────────
// Every field below is read out of the response of GET /dashboard/stats
// (apps/api/src/routes/dashboard.ts:536-575). The page declares its own
// shape because the shared DTO of packages/types/src/dashboard.ts carries no
// pendingVerifications and no roomOccupancyMatrix.

interface RevenueHistoryPoint {
  month: string;
  collected: number;
  expected: number;
}

interface MealFeedbackTrendPoint {
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

interface PaymentFunnelStage {
  count: number;
  totalAmount: number;
}

interface OccupancyHistoryPoint {
  month: string;
  occupied: number;
  total: number;
}

interface ServiceHistoryEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  status: 'success' | 'warning' | 'danger';
}

interface DashboardStats {
  occupancy: { totalRooms: number; totalBeds?: number; occupiedBeds: number; vacancyRate: number };
  revenue: { collected: number; expected: number; month: string };
  complaints: { open: number; inProgress: number; resolved: number; dismissed: number };
  services: { operational: number; degraded: number; down: number };
  enquiries: { pending: number; contacted?: number; newThisWeek?: number };
  pendingVerifications?: number;
  recent: {
    complaints: Array<{
      _id: string;
      title: string;
      status: string;
      category?: string;
      tenantId?: { userId?: { name: string } };
      createdAt: string;
    }>;
    enquiries: Array<{
      _id: string;
      name: string;
      phone: string;
      status: string;
      createdAt: string;
    }>;
  };
  revenueHistory: RevenueHistoryPoint[];
  occupancyHistory?: OccupancyHistoryPoint[];
  mealFeedbackTrend: MealFeedbackTrendPoint[];
  complaintsByCategory: Array<{ _id: string; count: number }>;
  paymentFunnel: Record<string, PaymentFunnelStage>;
  amenityHealth: Record<
    string,
    { operational: number; degraded: number; down: number; total: number }
  >;
  complaintHeatmap: Record<string, number>;
  serviceHistory?: ServiceHistoryEvent[];
  roomOccupancyMatrix?: RoomBedMatrixItem[];
  complaintSla?: IComplaintSlaMetrics;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** The month the server named, as a name: "2026-10" becomes "October 2026". */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/** The same month without the year: "October". */
function shortMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
}

/** The same month as a chart tick: "Oct". */
function monthTick(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
}

/** A date as the address bar carries it: YYYY-MM-DD. */
function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (dateStr == null) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN');
  } catch {
    return dateStr;
  }
}

/** The days between the day a record was raised and today. */
function getDaysAgo(dateStr: string): number {
  const created = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function complaintStatusMeta(status: string): {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string;
} {
  switch (status) {
    case 'open':
      return { variant: 'danger', label: 'Open' };
    case 'in_progress':
      return { variant: 'warning', label: 'In Progress' };
    case 'resolved':
      return { variant: 'success', label: 'Resolved' };
    case 'dismissed':
      return { variant: 'neutral', label: 'Dismissed' };
    default:
      return { variant: 'neutral', label: status };
  }
}

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * The mean of the numbers the server reports, or 0 when there are none.
 *
 * Only the days that carry a rating are counted: the server writes 0 for a
 * day no resident rated, and a day nobody rated is not a day the food scored
 * zero.
 */
function averageOf(values: number[]): number {
  const rated = values.filter((value) => value > 0);
  if (rated.length === 0) return 0;
  const sum = rated.reduce((total, value) => total + value, 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

/** True when the residents rated at least one meal of that day. */
function hasRating(day: MealFeedbackTrendPoint): boolean {
  return day.breakfast > 0 || day.lunch > 0 || day.dinner > 0;
}

/** The order the complaint list is read in: what needs work comes first. */
const STATUS_PRIORITY: Record<string, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  dismissed: 3,
};

// ── What the panels say ─────────────────────────────────────────────────
//
// The prose of the panels lives here, so that it is read as one piece and
// not as a paragraph of a screen.

const ACT_NOW_NOTE = `Every link opens the list it names, already filtered. Every count is the server's own count of that list.`;

const MONEY_NOTE = `Collected is what the server reports as paid for the bills of the month it names. Billed is the gross total of the invoices it raised for that month, before anything was paid against them. A payment that is still waiting for its verification is not counted as collected.`;

const BILLS_NOTE = `A bill that is not paid is a resident who owes money: the row opens the bills of that state for the month, so the office can chase them.`;

const LEGEND_TRUTH = `Every number on this page is the server's own count, read from GET /dashboard/stats. The dashboard has no filters: it is the whole building, and it says which day and which month it is showing.`;

const LEGEND_MONEY = `The money covers the month the server names. Collected is what the server reports as paid for the bills of that month; billed is the gross total it raised for that month, before anything was paid against it. The ledger cannot be filtered by billing month from a link, so the money opens the whole ledger.`;

const LEGEND_BEDS = `The bed map counts the beds of the rooms in service. The occupancy history counts the residents whose stay overlaps each month, so the two are not the same measure and the panel says which is which.`;

const LEGEND_WINDOWS = `The complaint heatmap covers this month, the meal scores and the service events cover the last 14 days, and the money and the occupancy history cover the last 6 months. A resident who has not paid is one click away: the bill rows open the bills that are waiting.`;

// ── The bill ladder ─────────────────────────────────────────────────────
//
// The counts of the bills of one month, one row per status. Every row opens
// the invoice list of that status and that month, so a resident who has not
// paid is one click from the office.
//
// The order is the order of the money: what is late, what is half paid, what
// is issued, what is not issued yet, what is settled.

const BILL_ROWS: Array<{ status: string; label: string; hint: string; dot: string }> = [
  {
    status: 'overdue',
    label: 'Overdue',
    hint: 'past the due date',
    dot: 'bg-(--color-danger-500)',
  },
  {
    status: 'partial',
    label: 'Partly paid',
    hint: 'some of the bill came in',
    dot: 'bg-(--color-warning-500)',
  },
  {
    status: 'sent',
    label: 'Issued, not paid',
    hint: 'the resident has the bill',
    dot: 'bg-(--color-brand-500)',
  },
  {
    status: 'draft',
    label: 'Draft',
    hint: 'not issued to the resident yet',
    dot: 'bg-(--chart-bar-secondary)',
  },
  {
    status: 'paid',
    label: 'Paid',
    hint: 'settled',
    dot: 'bg-(--color-success-500)',
  },
];

// ── Panel chrome ────────────────────────────────────────────────────────

/** The header of a panel: its title, the scope of its numbers and its action. */
function PanelHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-display text-15 font-bold tracking-tight text-(--color-text-primary)">
          {title}
        </h3>
        {subtitle && (
          <p className="text-2xs mt-0.5 leading-snug font-medium text-(--color-text-muted)">
            {subtitle}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="group text-12 inline-flex flex-shrink-0 items-center gap-1 font-semibold text-(--color-brand-600) transition-colors hover:text-(--color-brand-700) focus:outline-none"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

/** The empty state of a panel: what is missing and where to go next. */
function PanelEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="mb-2 text-(--color-text-muted)">{icon}</div>
      <p className="text-13 font-semibold text-(--color-text-primary)">{title}</p>
      {description && (
        <p className="text-2xs mt-1 max-w-xs leading-relaxed font-medium text-(--color-text-muted)">
          {description}
        </p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-3" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ── Dashboard Page ──────────────────────────────────────────────────────

const DASHBOARD_STATS_KEY = ['dashboard', 'stats'] as const;

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: stats,
    isPending: isLoading,
    error: queryError,
    dataUpdatedAt,
  } = useApiQuery<DashboardStats>(DASHBOARD_STATS_KEY, 'dashboard/stats');
  const queryErrorMessage = errorMessage(queryError);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_STATS_KEY });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // The dashboard is a read model: when the office works somewhere else, the
  // numbers here are re-read, so the screen never shows a stale morning.
  useSSE(
    useCallback(
      (event: string) => {
        if (
          event === 'payment_received' ||
          event === 'payment_verified' ||
          event === 'new_complaint' ||
          event === 'complaint_updated' ||
          event === 'service_update' ||
          event === 'new_enquiry' ||
          event === 'tenant_checkin' ||
          event === 'tenant_checkout' ||
          event === 'notification_created' ||
          event === 'meal_feedback_submitted' ||
          event === 'emergency_alert'
        ) {
          void queryClient.invalidateQueries({ queryKey: DASHBOARD_STATS_KEY });
        }
      },
      [queryClient],
    ),
  );

  if (isLoading) return <DashboardSkeleton />;

  if (!stats) {
    return (
      <ErrorState
        title={queryErrorMessage || 'Failed to load the dashboard'}
        description="We could not read the operational metrics. Check the connection and try again."
        onRetry={() => window.location.reload()}
      />
    );
  }

  // ── What the server says ──────────────────────────────────────────────
  //
  // Every number below is a count the server returned. Nothing is counted on
  // the screen, except the shares, and a share is a ratio of two server
  // numbers over the same set.

  const month = stats.revenue.month;
  const monthName = monthLabel(month);
  const monthShort = shortMonth(month);

  const pendingVerifications = stats.pendingVerifications ?? 0;
  const openComplaints = stats.complaints.open;
  const inProgressComplaints = stats.complaints.inProgress;
  const newLeads = stats.enquiries.pending;
  const contactedLeads = stats.enquiries.contacted ?? 0;
  const newLeadsThisWeek = stats.enquiries.newThisWeek ?? 0;

  const totalComplaints =
    stats.complaints.open +
    stats.complaints.inProgress +
    stats.complaints.resolved +
    stats.complaints.dismissed;
  const resolvedRate =
    totalComplaints > 0 ? Math.round((stats.complaints.resolved / totalComplaints) * 100) : 0;

  const totalBeds = stats.occupancy.totalBeds ?? 0;
  const occupiedBeds = stats.occupancy.occupiedBeds;
  const freeBeds = Math.max(totalBeds - occupiedBeds, 0);
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const serviceTotal = stats.services.operational + stats.services.degraded + stats.services.down;
  const serviceHealthPct =
    serviceTotal > 0 ? Math.round((stats.services.operational / serviceTotal) * 100) : 0;

  // The bills of the month the server names, one count per status.
  const billCounts = BILL_ROWS.map((row) => ({
    ...row,
    count: stats.paymentFunnel?.[row.status]?.count ?? 0,
  }));
  const overdueBills = billCounts.find((row) => row.status === 'overdue')?.count ?? 0;

  /**
   * The number this screen owns.
   *
   * It is the sum of the four queues the office can work on right now, and
   * no other module can compute it: each of the four is another module's own
   * count. The bill count covers the month the server names; the other three
   * are what the server holds right now.
   */
  const workWaiting = pendingVerifications + overdueBills + openComplaints + newLeads;

  const answeredAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // The money of the month, and the month before it, for the comparison.
  const revenueHistory = stats.revenueHistory;
  const lastPoint = revenueHistory.length > 0 ? revenueHistory[revenueHistory.length - 1] : null;
  const previousPoint =
    revenueHistory.length > 1 ? revenueHistory[revenueHistory.length - 2] : null;
  const thisMonthCollected = lastPoint?.collected ?? 0;
  const lastMonthCollected = previousPoint?.collected ?? 0;
  const momDelta =
    lastMonthCollected > 0
      ? Math.round(((thisMonthCollected - lastMonthCollected) / lastMonthCollected) * 100)
      : null;

  const revenueChartData = revenueHistory.map((r) => ({
    collected: r.collected,
    expected: r.expected,
  }));
  const revenueChartLabels = revenueHistory.map((r) => monthTick(r.month));

  const occupancyHistory = stats.occupancyHistory ?? [];
  const lastOccupancy = occupancyHistory[occupancyHistory.length - 1] ?? null;
  const residentsThisMonth = lastOccupancy?.occupied ?? 0;
  const bedsNowNote = `Now: ${occupiedBeds} of ${totalBeds} beds taken (${occupancyRate}%)`;
  const residentsNote = `${residentsThisMonth} residents on the books`;

  // The meal scores the server holds for the last 14 days.
  const mealAverages = {
    breakfast: averageOf(stats.mealFeedbackTrend.map((day) => day.breakfast)),
    lunch: averageOf(stats.mealFeedbackTrend.map((day) => day.lunch)),
    dinner: averageOf(stats.mealFeedbackTrend.map((day) => day.dinner)),
  };
  const mealChartData = stats.mealFeedbackTrend.map((day) => ({
    breakfast: day.breakfast,
    lunch: day.lunch,
    dinner: day.dinner,
  }));
  const mealChartLabels = stats.mealFeedbackTrend.map((day) =>
    new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  );
  const hasMealFeedback = stats.mealFeedbackTrend.some(hasRating);

  const amenityRows = Object.entries(stats.amenityHealth ?? {}).map(([type, health]) => ({
    type: type.replace(/_/g, ' '),
    operational: health.operational,
    degraded: health.degraded,
    down: health.down,
    total: health.total,
  }));

  const heatmapDays = Object.keys(stats.complaintHeatmap ?? {});
  const sortedComplaints = [...stats.recent.complaints].sort(
    (a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99),
  );

  // The copy of the panels, built from the numbers of the server.
  const moneySubtitle =
    momDelta != null
      ? `Collected ${fmtMoney(stats.revenue.collected)} against ${fmtMoney(stats.revenue.expected)} billed · ${momDelta >= 0 ? '+' : ''}${momDelta}% against the month before`
      : `Collected ${fmtMoney(stats.revenue.collected)} against ${fmtMoney(stats.revenue.expected)} billed`;
  const bedsSubtitle = `${stats.occupancy.totalRooms} rooms in service · ${occupiedBeds} / ${totalBeds} beds taken · ${freeBeds} free`;
  const complaintsSubtitle = `${totalComplaints} in all · ${openComplaints} open · ${inProgressComplaints} in progress · ${resolvedRate}% resolved`;
  const servicesSubtitle = `${stats.services.operational} of ${serviceTotal} service rows are up · ${stats.services.degraded} degraded · ${stats.services.down} down · the board cannot be filtered by state from a link yet`;
  const leadsSubtitle = `${newLeads} new · ${contactedLeads} contacted · ${newLeadsThisWeek} raised in the last 7 days`;
  const mealNote = `The mean of the days the residents rated: breakfast ${mealAverages.breakfast.toFixed(1)}, lunch ${mealAverages.lunch.toFixed(1)}, dinner ${mealAverages.dinner.toFixed(1)}.`;

  // ── The links ─────────────────────────────────────────────────────────
  //
  // Every link below names the list it opens, and that list reads the
  // parameter out of the address bar, so the operator lands filtered.

  const openPaymentsToVerify = () => router.push('/payments?status=pending_verification');
  const openOverdueBills = () => router.push(`/invoices?status=overdue&month=${month}`);
  const openOpenComplaints = () => router.push('/complaints?status=open');
  const openNewLeads = () => router.push('/enquiries?status=new');

  const openAgingWindow = (tier: 'under24h' | 'between24And48h' | 'over48h') => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (tier === 'over48h') {
      router.push(`/complaints?toDate=${isoDate(new Date(now - 2 * day))}`);
      return;
    }
    if (tier === 'between24And48h') {
      const from = isoDate(new Date(now - 2 * day));
      const to = isoDate(new Date(now - day));
      router.push(`/complaints?fromDate=${from}&toDate=${to}`);
      return;
    }
    router.push(`/complaints?fromDate=${isoDate(new Date(now - day))}`);
  };

  // ── The band: the queues the office can work on ───────────────────────

  const bandMetrics: PageBandMetric[] = [
    {
      label: 'To work on now',
      value: String(workWaiting),
      hint: workWaiting === 0 ? 'nothing is waiting' : 'payments, bills, complaints and leads',
      tone: workWaiting === 0 ? 'success' : 'brand',
    },
    {
      label: 'Payments to verify',
      value: String(pendingVerifications),
      hint: 'pending verification',
      tone: pendingVerifications > 0 ? 'warning' : 'success',
      onClick: openPaymentsToVerify,
    },
    {
      label: 'Overdue bills',
      value: String(overdueBills),
      hint: `of ${monthShort}`,
      tone: overdueBills > 0 ? 'danger' : 'success',
      onClick: openOverdueBills,
    },
    {
      label: 'Open complaints',
      value: String(openComplaints),
      hint: 'the server holds them as open',
      tone: openComplaints > 0 ? 'danger' : 'success',
      onClick: openOpenComplaints,
    },
    {
      label: 'New leads',
      value: String(newLeads),
      hint: 'enquiries the server holds as new',
      tone: newLeads > 0 ? 'warning' : 'success',
      onClick: openNewLeads,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Dashboard"
        description={`${todayLabel} · the whole building, no filters · the server answered at ${answeredAt || 'the first load'}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={isRefreshing} onClick={handleRefresh}>
              <RotateCw className={clsx('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            <Button size="sm" onClick={() => router.push('/payments/new')}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Record Payment
            </Button>
          </div>
        }
      />

      {/* ── The band: what is waiting, and where it is ─────────────── */}
      <section aria-label="Act now" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-15 font-bold tracking-tight text-(--color-text-primary)">
            Act now
          </h2>
          <p className="text-2xs font-medium text-(--color-text-muted)">{ACT_NOW_NOTE}</p>
        </div>
        <PageBand metrics={bandMetrics} />
      </section>

      {/* ── The building ───────────────────────────────────────────── */}
      <section aria-label="The building" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Surface as="div" variant="card" padding="md" className="lg:col-span-2">
          <PanelHeader
            title="The building, bed by bed"
            subtitle={bedsSubtitle}
            actionLabel="Open the bed map"
            onAction={() => router.push('/rooms')}
          />
          {stats.roomOccupancyMatrix && stats.roomOccupancyMatrix.length > 0 ? (
            <RoomBedHeatmap rooms={stats.roomOccupancyMatrix} />
          ) : (
            <PanelEmpty
              icon={<BedDouble className="h-10 w-10" />}
              title="No room in service"
              description="The server holds no active room, so it holds no bed either."
              action={{
                label: 'Open the rooms',
                onClick: () => router.push('/rooms'),
              }}
            />
          )}
        </Surface>

        <Surface as="div" variant="card" padding="md" className="flex flex-col">
          <PanelHeader
            title="Residents over six months"
            subtitle="the residents whose stay overlaps each month, against the beds in service"
            actionLabel="Open the residents"
            onAction={() => router.push('/tenants')}
          />
          {occupancyHistory.length === 0 ? (
            <PanelEmpty
              icon={<Users className="h-10 w-10" />}
              title="No stay history yet"
              description="The server has no resident record with a move-in date to place in a month."
              action={{
                label: 'Open the residents',
                onClick: () => router.push('/tenants'),
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col justify-between">
              <LineChart
                data={occupancyHistory.map((point) => ({
                  occupied: point.occupied,
                  total: point.total,
                }))}
                labels={occupancyHistory.map((point) => monthTick(point.month))}
                height={200}
                lines={[
                  { key: 'occupied', color: chartTokens.brand, label: 'Residents' },
                  { key: 'total', color: chartTokens.barSecondary, label: 'Beds' },
                ]}
                showGrid
                showLegend
              />
              <div className="text-12 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-(--border-color)/60 pt-3 font-medium text-(--color-text-muted)">
                <span>{bedsNowNote}</span>
                <span className="font-bold text-(--color-text-primary)">{residentsNote}</span>
              </div>
            </div>
          )}
        </Surface>
      </section>

      {/* ── The money ──────────────────────────────────────────────── */}
      <section aria-label="The money" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Surface as="div" variant="card" padding="md" className="lg:col-span-2">
          <PanelHeader
            title={`Money of ${monthName}`}
            subtitle={moneySubtitle}
            actionLabel="Open the ledger"
            onAction={() => router.push('/payments')}
          />
          {revenueHistory.length === 0 ? (
            <PanelEmpty
              icon={<IndianRupee className="h-10 w-10" />}
              title="No money recorded yet"
              description="The server holds no payment and no invoice for the last six months."
              action={{
                label: 'Open the ledger',
                onClick: () => router.push('/payments'),
              }}
            />
          ) : (
            <>
              <LineChart
                data={revenueChartData}
                labels={revenueChartLabels}
                height={220}
                lines={[
                  { key: 'collected', color: chartTokens.brand, label: 'Collected' },
                  { key: 'expected', color: chartTokens.barSecondary, label: 'Billed (gross)' },
                ]}
                showGrid
                showLegend
                isCurrency
              />
              <p className="text-2xs mt-3 leading-relaxed font-medium text-(--color-text-muted)">
                {MONEY_NOTE}
              </p>
            </>
          )}
        </Surface>

        <Surface as="div" variant="card" padding="md" className="flex flex-col">
          <PanelHeader
            title={`Bills of ${monthShort}`}
            subtitle="every bill the server holds for this month, by what it is waiting for"
            actionLabel="Open the bills"
            onAction={() => router.push(`/invoices?month=${month}`)}
          />
          <div className="space-y-2.5">
            {billCounts.map((row) => (
              <button
                key={row.status}
                type="button"
                onClick={() => router.push(`/invoices?status=${row.status}&month=${month}`)}
                className={clsx(
                  surfaceNestedClass,
                  'group flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors duration-(--transition-duration) hover:border-(--color-brand-200) hover:bg-(--color-field-bg-hover)',
                )}
              >
                <span className={clsx('h-2.5 w-2.5 flex-shrink-0 rounded-full', row.dot)} />
                <span className="min-w-0 flex-1">
                  <span className="text-13 block font-semibold text-(--color-text-primary)">
                    {row.label}
                  </span>
                  <span className="text-2xs mt-0.5 block font-medium text-(--color-text-muted)">
                    {row.hint}
                  </span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-2">
                  <span className="font-display text-15 font-bold text-(--color-text-primary) tabular-nums">
                    {row.count}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-(--color-text-muted) transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
          <p className="text-2xs mt-4 leading-relaxed font-medium text-(--color-text-muted)">
            {BILLS_NOTE}
          </p>
        </Surface>
      </section>

      {/* ── Complaints ─────────────────────────────────────────────── */}
      <section aria-label="Complaints" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Surface as="div" variant="card" padding="md">
          <PanelHeader
            title="Complaints"
            subtitle={complaintsSubtitle}
            actionLabel="Open the complaint board"
            onAction={() => router.push('/complaints')}
          />
          {totalComplaints === 0 ? (
            <PanelEmpty
              icon={<CheckCircle2 className="h-10 w-10" />}
              title="No complaint logged"
              description="The server holds no complaint for this building."
              action={{
                label: 'Open the complaint board',
                onClick: () => router.push('/complaints'),
              }}
            />
          ) : (
            <ComplaintResolutionHub
              complaints={stats.complaints}
              totalComplaints={totalComplaints}
              resolvedRate={resolvedRate}
              slaMetrics={stats.complaintSla}
              onStatusClick={(status) => router.push(`/complaints?status=${status}`)}
              onAgingClick={openAgingWindow}
              onManageClick={() => router.push('/complaints')}
            />
          )}
          <p className="text-2xs mt-4 leading-relaxed font-medium text-(--color-text-muted)">
            The aging rails count the open and in-progress tickets, and open every complaint raised
            in that window.
          </p>
        </Surface>

        <div className="space-y-6">
          <Surface as="div" variant="card" padding="md">
            <PanelHeader
              title="What the residents complain about"
              subtitle="every complaint the server holds, by its category"
              actionLabel="Open the categories"
              onAction={() => router.push('/complaints')}
            />
            {totalComplaints === 0 ? (
              <PanelEmpty
                icon={<CheckCircle2 className="h-10 w-10" />}
                title="Nothing to rank"
                description="With no complaint logged there is no category to rank."
              />
            ) : (
              <ComplaintCategoryMatrix
                categories={stats.complaintsByCategory ?? []}
                totalComplaints={totalComplaints}
                onCategoryClick={(category) => router.push(`/complaints?category=${category}`)}
              />
            )}
          </Surface>

          <Surface as="div" variant="card" padding="md">
            <PanelHeader
              title="The complaints just raised"
              subtitle={`the ${stats.recent.complaints.length} most recent complaints the server holds`}
              actionLabel="Open the board"
              onAction={() => router.push('/complaints')}
            />
            {sortedComplaints.length === 0 ? (
              <PanelEmpty
                icon={<CheckCircle2 className="h-10 w-10" />}
                title="Nothing was raised"
                description="The server holds no complaint."
                action={{
                  label: 'Log a complaint',
                  onClick: () => router.push('/complaints/new'),
                }}
              />
            ) : (
              <div className="space-y-2">
                {sortedComplaints.map((complaint) => {
                  const meta = complaintStatusMeta(complaint.status);
                  const isOpen = complaint.status === 'open';
                  const isActive = isOpen || complaint.status === 'in_progress';
                  const daysAgo = getDaysAgo(complaint.createdAt);
                  const showAge = isActive && daysAgo >= 3;
                  const who = `${complaint.tenantId?.userId?.name ?? 'Unknown resident'} · ${formatDate(complaint.createdAt)}`;

                  return (
                    <button
                      key={complaint._id}
                      type="button"
                      onClick={() => router.push(`/complaints/${complaint._id}`)}
                      className={clsx(
                        surfaceNestedClass,
                        'group flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors duration-(--transition-duration) hover:border-(--color-brand-200) hover:bg-(--color-field-bg-hover)',
                      )}
                    >
                      <span
                        className={clsx(
                          'h-2.5 w-2.5 flex-shrink-0 rounded-full',
                          isOpen && 'bg-(--color-danger-500)',
                          complaint.status === 'in_progress' && 'bg-(--color-warning-500)',
                          complaint.status === 'resolved' && 'bg-(--color-success-500)',
                          !isActive &&
                            complaint.status !== 'resolved' &&
                            'bg-(--chart-bar-secondary)',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-13 block truncate font-semibold text-(--color-text-primary)">
                          {complaint.title}
                        </span>
                        <span className="text-2xs mt-0.5 block font-medium text-(--color-text-muted)">
                          {who}
                        </span>
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-1.5">
                        {showAge && (
                          <span
                            className={clsx(
                              'text-3xs flex-shrink-0 rounded-full border px-1.5 py-0.5 font-bold',
                              daysAgo > 7
                                ? 'border-(--badge-danger-border) bg-(--badge-danger-bg) text-(--badge-danger-text)'
                                : 'border-(--badge-warning-border) bg-(--badge-warning-bg) text-(--badge-warning-text)',
                            )}
                          >
                            {daysAgo}d
                          </span>
                        )}
                        <StatusBadge variant={meta.variant} label={meta.label} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Surface>
        </div>
      </section>

      {/* ── Services and residents ─────────────────────────────────── */}
      <section
        aria-label="Services and residents"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <Surface as="div" variant="card" padding="md">
          <PanelHeader
            title="Services"
            subtitle={servicesSubtitle}
            actionLabel="Open the service board"
            onAction={() => router.push('/services')}
          />
          {serviceTotal === 0 ? (
            <PanelEmpty
              icon={<Wifi className="h-10 w-10" />}
              title="No service row yet"
              description="The server holds no service status for any floor."
              action={{
                label: 'Open the service board',
                onClick: () => router.push('/services'),
              }}
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:px-4">
                <GaugeChart
                  value={stats.services.operational}
                  max={serviceTotal}
                  size={120}
                  label="Operational"
                  sublabel={`${stats.services.operational} of ${serviceTotal} up`}
                  colorVar={
                    serviceHealthPct === 100
                      ? '--color-success-500'
                      : serviceHealthPct >= 70
                        ? '--color-warning-500'
                        : '--color-danger-500'
                  }
                />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--badge-success-border) bg-(--badge-success-bg) px-3 py-1.5">
                    <span className="h-2 w-2 rounded-full bg-(--color-success-500)" />
                    <span className="text-12 font-bold text-(--badge-success-text)">
                      {stats.services.operational} operational
                    </span>
                  </div>
                  {stats.services.degraded > 0 && (
                    <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--badge-warning-border) bg-(--badge-warning-bg) px-3 py-1.5">
                      <span className="h-2 w-2 rounded-full bg-(--color-warning-500)" />
                      <span className="text-12 font-bold text-(--badge-warning-text)">
                        {stats.services.degraded} degraded
                      </span>
                    </div>
                  )}
                  {stats.services.down > 0 && (
                    <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--badge-danger-border) bg-(--badge-danger-bg) px-3 py-1.5">
                      <span className="h-2 w-2 rounded-full bg-(--color-danger-500)" />
                      <span className="text-12 font-bold text-(--badge-danger-text)">
                        {stats.services.down} down
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {amenityRows.length > 0 && (
                <div>
                  <p className="text-2xs mb-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                    By service type
                  </p>
                  <div className="space-y-1.5">
                    {amenityRows.map((row) => {
                      const health = `${row.operational} up · ${row.degraded} degraded · ${row.down} down of ${row.total}`;

                      return (
                        <div
                          key={row.type}
                          className="flex items-center justify-between gap-3 border-b border-(--border-color)/60 pb-1.5 last:border-b-0"
                        >
                          <span className="text-12 font-medium text-(--color-text-secondary)">
                            {row.type}
                          </span>
                          <span className="text-2xs font-medium text-(--color-text-muted)">
                            {health}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stats.serviceHistory && stats.serviceHistory.length > 0 && (
                <div className="border-t border-(--border-color)/60 pt-3">
                  <p className="text-2xs mb-2 font-bold tracking-wider text-(--color-text-muted) uppercase">
                    Status changes of the last 14 days
                  </p>
                  <div className="max-h-[160px] overflow-y-auto pr-1">
                    <Timeline
                      events={stats.serviceHistory.slice(0, 5).map((event) => ({
                        id: event.id,
                        date: event.date,
                        title: event.title,
                        description: event.description,
                        status: event.status,
                      }))}
                      maxHeight={160}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Surface>

        <div className="space-y-6">
          <Surface as="div" variant="card" padding="md">
            <PanelHeader
              title="Meals"
              subtitle="the rating the server holds for each meal, day by day over the last 14 days"
              actionLabel="Open the meals"
              onAction={() => router.push('/meals')}
            />
            {!hasMealFeedback ? (
              <PanelEmpty
                icon={<UtensilsCrossed className="h-10 w-10" />}
                title="No meal feedback in the last 14 days"
                description="The server holds no rating for any meal of that window."
                action={{
                  label: 'Open the meals',
                  onClick: () => router.push('/meals'),
                }}
              />
            ) : (
              <>
                <LineChart
                  data={mealChartData}
                  labels={mealChartLabels}
                  height={180}
                  lines={[
                    { key: 'breakfast', color: chartTokens.warning, label: 'Breakfast' },
                    { key: 'lunch', color: chartTokens.brand, label: 'Lunch' },
                    { key: 'dinner', color: chartTokens.barSecondary, label: 'Dinner' },
                  ]}
                  showGrid
                  showLegend
                />
                <p className="text-2xs mt-3 border-t border-(--border-color)/60 pt-3 font-medium text-(--color-text-muted)">
                  {mealNote}
                </p>
              </>
            )}
          </Surface>

          <Surface as="div" variant="card" padding="md">
            <PanelHeader
              title="Leads"
              subtitle={leadsSubtitle}
              actionLabel="Open the leads"
              onAction={() => router.push('/enquiries?status=new')}
            />
            {stats.recent.enquiries.length === 0 ? (
              <PanelEmpty
                icon={<PhoneCall className="h-10 w-10" />}
                title="No enquiry yet"
                description="The server holds no enquiry for this building."
                action={{
                  label: 'Open the leads',
                  onClick: () => router.push('/enquiries'),
                }}
              />
            ) : (
              <div className="space-y-2">
                {stats.recent.enquiries.map((enquiry) => (
                  <button
                    key={enquiry._id}
                    type="button"
                    onClick={() => router.push(`/enquiries/${enquiry._id}`)}
                    className={clsx(
                      surfaceNestedClass,
                      'group flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition-colors duration-(--transition-duration) hover:border-(--color-brand-200) hover:bg-(--color-field-bg-hover)',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-13 block truncate font-semibold text-(--color-text-primary)">
                        {enquiry.name}
                      </span>
                      <span className="text-2xs mt-0.5 block font-medium text-(--color-text-muted)">
                        {enquiry.phone} · {formatDate(enquiry.createdAt)}
                      </span>
                    </span>
                    <StatusBadge
                      variant={
                        enquiry.status === 'new'
                          ? 'warning'
                          : enquiry.status === 'contacted'
                            ? 'info'
                            : 'success'
                      }
                      label={enquiry.status.replace(/_/g, ' ')}
                    />
                  </button>
                ))}
              </div>
            )}
          </Surface>
        </div>
      </section>

      {/* ── When the complaints came in ────────────────────────────── */}
      {heatmapDays.length > 0 && (
        <section aria-label="Complaints by day">
          <Surface as="div" variant="card" padding="md">
            <PanelHeader
              title="Complaints by day this month"
              subtitle="every complaint the server holds for the days of this month; a day opens that day"
              actionLabel="Open the board"
              onAction={() => router.push('/complaints')}
            />
            <div className="flex justify-center py-2">
              <HeatmapCalendar
                data={stats.complaintHeatmap}
                year={new Date().getFullYear()}
                month={new Date().getMonth()}
                colorScale="danger"
                size={15}
                onDayClick={(date, count) => {
                  if (count > 0) router.push(`/complaints?date=${date}`);
                }}
              />
            </div>
          </Surface>
        </section>
      )}

      {/* ── What the numbers mean ──────────────────────────────────── */}
      <div className="text-2xs space-y-1.5 font-medium text-(--color-text-muted)">
        <p>
          <Clock className="mr-1 inline h-3 w-3" />
          {LEGEND_TRUTH}
        </p>
        <p>
          <CreditCard className="mr-1 inline h-3 w-3" />
          {LEGEND_MONEY}
        </p>
        <p>
          <Users className="mr-1 inline h-3 w-3" />
          {LEGEND_BEDS}
        </p>
        <p>
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {LEGEND_WINDOWS}
        </p>
      </div>
    </div>
  );
}
