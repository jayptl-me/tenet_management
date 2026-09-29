'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BedDouble,
  CreditCard,
  AlertTriangle,
  PhoneCall,
  Users,
  IndianRupee,
  CheckCircle2,
  Clock,
  Wifi,
  ArrowRight,
  UtensilsCrossed,
  RotateCw,
  Plus,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Sparkline } from '@/components/ui/Sparkline';
import { ComplaintCategoryMatrix } from '@/components/ui/ComplaintCategoryMatrix';
import { MealFeedbackLedger } from '@/components/ui/MealFeedbackLedger';
import { FunnelChart } from '@/components/ui/FunnelChart';
import { RoomBedHeatmap, type RoomBedMatrixItem } from '@/components/ui/RoomBedHeatmap';
import { ComplaintResolutionHub } from '@/components/ui/ComplaintResolutionHub';
import type { IComplaintSlaMetrics } from '@pg/types';
import { HeatmapCalendar } from '@/components/ui/HeatmapCalendar';
import { Timeline } from '@/components/ui/Timeline';
import { LineChart } from '@/components/ui/LineChart';
import { GaugeChart } from '@/components/ui/GaugeChart';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { ErrorState } from '@/components/ui/ErrorState';
import { AttentionRequiredBanner } from '@/components/admin/AttentionRequiredBanner';
import { useSSE } from '@/hooks/useSSE';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';
import { surfaceNestedClass } from '@/lib/field-styles';
import { chartTokens } from '@/lib/chart-theme';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  dismissed: 3,
};

const FUNNEL_COLORS: Record<string, { color: string; ink?: string }> = {
  draft: { color: chartTokens.barSecondary, ink: 'var(--chart-label)' },
  sent: { color: 'var(--color-info-500)', ink: 'var(--color-on-info)' },
  partial: { color: chartTokens.warning, ink: 'var(--color-on-warning)' },
  paid: { color: chartTokens.success, ink: 'var(--color-on-success)' },
  overdue: { color: chartTokens.danger, ink: 'var(--color-on-danger)' },
};

const FUNNEL_ORDER = ['paid', 'sent', 'partial', 'overdue', 'draft'];

function formatDate(dateStr: string | null | undefined): string {
  if (dateStr == null) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN');
  } catch {
    return dateStr;
  }
}

function getDaysAgo(dateStr: string): number {
  const created = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function complaintStatusMeta(status: string): {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'open':
      return { variant: 'danger', label: 'Open', icon: <AlertTriangle className="h-3 w-3" /> };
    case 'in_progress':
      return { variant: 'warning', label: 'In Progress', icon: <Clock className="h-3 w-3" /> };
    case 'resolved':
      return { variant: 'success', label: 'Resolved', icon: <CheckCircle2 className="h-3 w-3" /> };
    case 'dismissed':
      return { variant: 'neutral', label: 'Dismissed', icon: <CheckCircle2 className="h-3 w-3" /> };
    default:
      return { variant: 'neutral', label: status, icon: null };
  }
}

// ── Refined Executive Section Header ───────────────────

function SectionHeader({
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
        <h3 className="font-display text-15 sm:text-16 font-bold tracking-tight text-(--color-text-primary)">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-2xs sm:text-12 leading-snug font-medium text-(--color-text-muted)">
            {subtitle}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="group inline-flex flex-shrink-0 items-center gap-1 text-12 font-semibold text-(--color-brand-600) transition-colors hover:text-(--color-brand-700) focus:outline-none"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

/** Compact empty state for inside Surface panels. */
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
        <p className="mt-1 max-w-xs text-2xs leading-relaxed font-medium text-(--color-text-muted)">
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

// ── Dashboard Page ─────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState('');

  const fetchStats = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await api
        .get('dashboard/stats')
        .json<{ success: boolean; data: DashboardStats }>();
      setStats(res.data);
      setError('');
      setLastUpdated(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time SSE listener: refresh operational KPIs automatically on domain events
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
          fetchStats();
        }
      },
      [fetchStats],
    ),
  );

  if (isLoading) return <DashboardSkeleton />;

  if (!stats) {
    return (
      <ErrorState
        title={error || 'Failed to load dashboard'}
        description="We could not load your operational metrics. Check your connection and try again."
        onRetry={() => window.location.reload()}
      />
    );
  }

  // ── Derived Data ──────────────────────────────
  const totalComplaints =
    stats.complaints.open +
    stats.complaints.inProgress +
    stats.complaints.resolved +
    stats.complaints.dismissed;
  const activeComplaints = stats.complaints.open + stats.complaints.inProgress;
  const resolvedRate =
    totalComplaints > 0 ? Math.round((stats.complaints.resolved / totalComplaints) * 100) : 0;
  const hasRevenueTarget = stats.revenue.expected > 0;
  const collectionRate = hasRevenueTarget
    ? Math.round((stats.revenue.collected / stats.revenue.expected) * 100)
    : 0;
  const serviceTotal = stats.services.operational + stats.services.degraded + stats.services.down;
  const serviceHealthPct =
    serviceTotal > 0 ? Math.round((stats.services.operational / serviceTotal) * 100) : 0;
  const totalBeds = stats.occupancy.totalBeds ?? 0;
  const vacantBeds = Math.max(totalBeds - stats.occupancy.occupiedBeds, 0);
  const occupancyRate =
    totalBeds > 0 ? Math.round((stats.occupancy.occupiedBeds / totalBeds) * 100) : 0;
  const newEnquiriesThisWeek = stats.enquiries.newThisWeek ?? 0;

  // Aging open complaints (>3 days)
  const agingOpenComplaints = stats.recent.complaints.filter(
    (c) => (c.status === 'open' || c.status === 'in_progress') && getDaysAgo(c.createdAt) >= 3,
  ).length;

  // Revenue chart data
  const revenueChartData = stats.revenueHistory.map((r) => ({
    collected: r.collected,
    expected: r.expected,
  }));
  const revenueLabels = stats.revenueHistory.map((r) => {
    const [y, m] = r.month.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short' });
  });

  // MoM delta: compare this month vs last month collected
  const momRevenueHistory = stats.revenueHistory;
  const thisMonthCollected =
    momRevenueHistory.length > 0 ? momRevenueHistory[momRevenueHistory.length - 1].collected : 0;
  const lastMonthCollected =
    momRevenueHistory.length > 1 ? momRevenueHistory[momRevenueHistory.length - 2].collected : 0;
  const momDelta =
    lastMonthCollected > 0
      ? Math.round(((thisMonthCollected - lastMonthCollected) / lastMonthCollected) * 100)
      : null;

  // Occupancy sparkline from real occupancyHistory
  const occupancySparkline =
    (stats.occupancyHistory?.length ?? 0) > 0
      ? stats.occupancyHistory!.map((r) => r.occupied)
      : [stats.occupancy.occupiedBeds];

  // Meal feedback averages
  const mealAvg = {
    breakfast:
      stats.mealFeedbackTrend.length > 0
        ? Math.round(
          (stats.mealFeedbackTrend.reduce((s, d) => s + d.breakfast, 0) /
            stats.mealFeedbackTrend.length) *
          10,
        ) / 10
        : 0,
    lunch:
      stats.mealFeedbackTrend.length > 0
        ? Math.round(
          (stats.mealFeedbackTrend.reduce((s, d) => s + d.lunch, 0) /
            stats.mealFeedbackTrend.length) *
          10,
        ) / 10
        : 0,
    dinner:
      stats.mealFeedbackTrend.length > 0
        ? Math.round(
          (stats.mealFeedbackTrend.reduce((s, d) => s + d.dinner, 0) /
            stats.mealFeedbackTrend.length) *
          10,
        ) / 10
        : 0,
  };

  // Complaints sorted by priority (open first)
  const sortedComplaints = [...stats.recent.complaints].sort(
    (a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99),
  );

  // Payment funnel data
  const paymentFunnelStages = FUNNEL_ORDER.filter(
    (key) => (stats.paymentFunnel?.[key]?.count ?? 0) > 0,
  ).map((key) => {
    const stage = FUNNEL_COLORS[key];
    return {
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: stats.paymentFunnel?.[key]?.count ?? 0,
      color: stage?.color ?? chartTokens.barSecondary,
      ink: stage?.ink,
    };
  });

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className="space-y-7"
    >
      {/* ── Header ─────────────────────────────────── */}
      <PageHeader
        title="Dashboard"
        description={`${todayLabel}${lastUpdated ? ` · Updated ${lastUpdated}` : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={() => fetchStats(true)}
            >
              <RotateCw className={clsx('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/payments/new')}
              className="hidden sm:inline-flex"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Record Payment
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/complaints/new')}>
              New Complaint
            </Button>
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════════
          ZONE 1: Executive North Star & Operational Triage
          ═══════════════════════════════════════════════════ */}
      <section aria-label="Executive Key Performance Indicators" className="space-y-4">
        {/* Metric Strip: 5 Executive Tiles (Stripe & Mercury Standard) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Card 1: Bed Occupancy */}
          <motion.div variants={fadeScaleIn} className="h-full">
            <StatCard
              title="Bed Occupancy"
              value={`${stats.occupancy.occupiedBeds} / ${totalBeds}`}
              subtitle={`${vacantBeds} vacant beds available`}
              icon={<Users />}
              tone="brand"
              progress={{
                value: stats.occupancy.occupiedBeds,
                max: totalBeds || 1,
                color: occupancyRate >= 80 ? 'var(--color-success-500)' : 'var(--color-brand-500)',
                label: 'Fill rate',
              }}
              trend={
                totalBeds === 0
                  ? { value: '0%', direction: 'neutral', label: 'occupied' }
                  : {
                    value: `${occupancyRate}%`,
                    direction: occupancyRate >= 80 ? 'up' : 'down',
                    label: 'occupied',
                  }
              }
              onClick={() => router.push('/tenants')}
            >
              <div className="mt-1 w-full">
                <Sparkline
                  data={occupancySparkline}
                  width="100%"
                  height={22}
                  color={chartTokens.brand}
                />
              </div>
            </StatCard>
          </motion.div>

          {/* Card 2: Monthly Revenue */}
          <motion.div variants={fadeScaleIn} className="h-full">
            <StatCard
              title="Monthly Revenue"
              value={`₹${stats.revenue.collected.toLocaleString('en-IN')}`}
              subtitle={
                hasRevenueTarget
                  ? `Target: ₹${stats.revenue.expected.toLocaleString('en-IN')}`
                  : 'No billed invoices this month'
              }
              icon={<IndianRupee />}
              tone="success"
              progress={
                hasRevenueTarget
                  ? {
                    value: stats.revenue.collected,
                    max: stats.revenue.expected || 1,
                    color:
                      collectionRate >= 80
                        ? 'var(--color-success-500)'
                        : 'var(--color-warning-500)',
                    label: 'Collection goal',
                  }
                  : undefined
              }
              trend={
                hasRevenueTarget
                  ? {
                    value: `${collectionRate}%`,
                    direction: collectionRate >= 80 ? 'up' : 'down',
                    label: 'of target',
                  }
                  : undefined
              }
              delta={
                momDelta != null
                  ? {
                    value: `${momDelta >= 0 ? '+' : ''}${momDelta}%`,
                    direction: momDelta >= 0 ? 'up' : 'down',
                    label: 'vs last mo',
                  }
                  : undefined
              }
              onClick={() => router.push('/payments')}
            />
          </motion.div>

          {/* Card 3: Active Complaints */}
          <motion.div variants={fadeScaleIn} className="h-full">
            <StatCard
              title="Active Complaints"
              value={activeComplaints}
              subtitle={`${stats.complaints.open} open · ${stats.complaints.inProgress} in progress`}
              icon={<AlertTriangle />}
              tone={activeComplaints > 0 ? 'warning' : 'success'}
              trend={
                totalComplaints === 0
                  ? { value: '0', direction: 'neutral', label: 'logged' }
                  : {
                    value: `${resolvedRate}%`,
                    direction: resolvedRate >= 70 ? 'up' : 'down',
                    label: 'resolved',
                  }
              }
              onClick={() => router.push('/complaints?status=open')}
            />
          </motion.div>

          {/* Card 4: Service Health */}
          <motion.div variants={fadeScaleIn} className="h-full">
            <StatCard
              title="Service Health"
              value={`${stats.services.operational} / ${serviceTotal}`}
              subtitle={`${stats.services.operational} up · ${stats.services.degraded} degraded · ${stats.services.down} down`}
              icon={<Wifi />}
              tone={
                stats.services.down > 0
                  ? 'danger'
                  : stats.services.degraded > 0
                    ? 'warning'
                    : 'success'
              }
              trend={
                serviceTotal === 0
                  ? { value: '100%', direction: 'neutral', label: 'operational' }
                  : {
                    value: `${serviceHealthPct}%`,
                    direction: serviceHealthPct >= 90 ? 'up' : 'down',
                    label: 'healthy',
                  }
              }
              onClick={() => router.push('/services')}
            />
          </motion.div>

          {/* Card 5: Lead Pipeline */}
          <motion.div variants={fadeScaleIn} className="h-full">
            <StatCard
              title="Lead Pipeline"
              value={stats.enquiries.pending}
              subtitle={`${stats.enquiries.contacted ?? 0} contacted · ${newEnquiriesThisWeek} this week`}
              icon={<PhoneCall />}
              tone="brand"
              trend={{
                value: `+${newEnquiriesThisWeek}`,
                direction: newEnquiriesThisWeek > 0 ? 'up' : 'neutral',
                label: 'this week',
              }}
              onClick={() => router.push('/enquiries?status=new')}
            />
          </motion.div>
        </div>

        {/* Operational Triage Banner */}
        <motion.div variants={fadeScaleIn}>
          <AttentionRequiredBanner
            pendingVerificationsCount={stats.pendingVerifications ?? 0}
            agingComplaintsCount={agingOpenComplaints}
            issuesServicesCount={stats.services.down + stats.services.degraded}
            newEnquiriesCount={stats.enquiries.pending}
            onNavigate={(href) => router.push(href)}
          />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════
          ZONE 2: Space & Capacity Command
          ═══════════════════════════════════════════════════ */}
      <section aria-label="Building Space & Capacity Command" className="space-y-6">
        {/* Heatmap & Capacity Velocity Grid: 2/3 + 1/3 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main: Interactive Room & Bed Heatmap (2 cols) */}
          <motion.div variants={fadeScaleIn} className="lg:col-span-2">
            <Surface as="div" variant="card" padding="md" className="h-full">
              <SectionHeader
                title="Building Floor & Bed Heatmap"
                subtitle="Live interactive floor occupancy matrix with bed availability and tenant tooltips"
                actionLabel="Manage Rooms"
                onAction={() => router.push('/rooms')}
              />
              <RoomBedHeatmap rooms={stats.roomOccupancyMatrix ?? []} />
            </Surface>
          </motion.div>

          {/* Side: Occupancy Trajectory (1 col) */}
          <motion.div variants={fadeScaleIn}>
            <Surface as="div" variant="card" padding="md" className="flex h-full flex-col">
              <SectionHeader
                title="Occupancy Trajectory"
                subtitle="Last 6 months — filled vs capacity"
                actionLabel="View Tenants"
                onAction={() => router.push('/tenants')}
              />
              {!stats.occupancyHistory || stats.occupancyHistory.length === 0 ? (
                <PanelEmpty
                  icon={<Users className="h-10 w-10" />}
                  title="No occupancy history yet"
                  description={
                    totalBeds === 0
                      ? 'Real-time snapshot: no beds tracked yet'
                      : `Real-time snapshot: ${stats.occupancy.occupiedBeds} of ${totalBeds} beds filled`
                  }
                />
              ) : (
                <div className="flex flex-1 flex-col justify-between">
                  <LineChart
                    data={stats.occupancyHistory.map((p) => ({
                      occupied: p.occupied,
                      total: p.total,
                    }))}
                    labels={stats.occupancyHistory.map((p) => {
                      const [y, m] = p.month.split('-');
                      return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', {
                        month: 'short',
                      });
                    })}
                    height={200}
                    lines={[
                      { key: 'occupied', color: chartTokens.brand, label: 'Occupied' },
                      { key: 'total', color: chartTokens.barSecondary, label: 'Capacity' },
                    ]}
                    showGrid
                    showLegend
                  />
                  <div className="mt-4 flex items-center justify-between border-t border-(--border-color)/60 pt-3 text-12 font-medium text-(--color-text-muted)">
                    <span>Current rate</span>
                    <span className="font-bold text-(--color-text-primary)">
                      {occupancyRate}% ({stats.occupancy.occupiedBeds} of {totalBeds} beds)
                    </span>
                  </div>
                </div>
              )}
            </Surface>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          ZONE 3: Financial Velocity & Service Command
          ═══════════════════════════════════════════════════ */}
      <section aria-label="Financial Velocity & Service Operations" className="space-y-6">
        {/* Financial Flow: Revenue Area Spline (2 cols) + Funnel (1 col) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Revenue Line Chart — 2/3 width */}
          <motion.div variants={fadeScaleIn} className="lg:col-span-2">
            <Surface as="div" variant="card" padding="md" className="h-full">
              <SectionHeader
                title="Revenue Velocity"
                subtitle={
                  momDelta != null
                    ? `Last 6 months collected vs billed · ${momDelta >= 0 ? '+' : ''}${momDelta}% MoM`
                    : 'Last 6 months collected vs billed'
                }
                actionLabel="View Payments"
                onAction={() => router.push('/payments')}
              />
              {stats.revenueHistory.length === 0 ? (
                <PanelEmpty
                  icon={<IndianRupee className="h-10 w-10" />}
                  title="No revenue data yet"
                  description="Collection history will appear once payments are recorded."
                />
              ) : (
                <LineChart
                  data={revenueChartData}
                  labels={revenueLabels}
                  height={220}
                  lines={[
                    { key: 'collected', color: chartTokens.brand, label: 'Collected' },
                    { key: 'expected', color: chartTokens.barSecondary, label: 'Expected' },
                  ]}
                  showGrid
                  showLegend
                  isCurrency
                />
              )}
            </Surface>
          </motion.div>

          {/* Payment Collection Funnel — 1/3 width */}
          <motion.div variants={fadeScaleIn}>
            <Surface as="div" variant="card" padding="md" className="h-full">
              <SectionHeader
                title="Invoicing Pipeline"
                subtitle="Current billing cycle status breakdown"
                actionLabel="View Invoices"
                onAction={() => router.push('/invoices')}
              />
              {paymentFunnelStages.length === 0 ? (
                <PanelEmpty
                  icon={<CreditCard className="h-10 w-10" />}
                  title="No invoices this month"
                  action={{ label: 'Create Invoice', onClick: () => router.push('/invoices/new') }}
                />
              ) : (
                <FunnelChart
                  stages={paymentFunnelStages}
                  maxWidth={100}
                  barHeight={26}
                  barGap={8}
                />
              )}
            </Surface>
          </motion.div>
        </div>

        {/* Operational Incident & Facility Command Grid: 2-Column Split */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Column A: Complaint Incident Command & Impact Matrix */}
          <div className="space-y-6">
            {/* Incident Pipeline */}
            <motion.div variants={fadeScaleIn}>
              <Surface as="div" variant="card" padding="md">
                <SectionHeader
                  title="Complaint SLA Command"
                  subtitle={`${totalComplaints} complaints · ${resolvedRate}% resolved rate`}
                  actionLabel="View Complaints"
                  onAction={() => router.push('/complaints')}
                />
                {totalComplaints === 0 ? (
                  <PanelEmpty
                    icon={<CheckCircle2 className="h-10 w-10" />}
                    title="No complaints logged"
                  />
                ) : (
                  <ComplaintResolutionHub
                    complaints={stats.complaints}
                    totalComplaints={totalComplaints}
                    resolvedRate={resolvedRate}
                    slaMetrics={stats.complaintSla}
                    onStatusClick={(status) => router.push(`/complaints?status=${status}`)}
                    onAgingClick={() => router.push('/complaints?status=open')}
                    onManageClick={() => router.push('/complaints')}
                  />
                )}
              </Surface>
            </motion.div>

            {/* Category Impact Matrix */}
            <motion.div variants={fadeScaleIn}>
              <Surface as="div" variant="card" padding="md">
                <SectionHeader
                  title="Complaint Impact Categories"
                  subtitle={
                    totalComplaints > 0
                      ? `Top ${stats.complaintsByCategory?.length ?? 0} issue categories by volume`
                      : 'No issues logged'
                  }
                  actionLabel="Manage"
                  onAction={() => router.push('/complaints')}
                />
                <ComplaintCategoryMatrix
                  categories={stats.complaintsByCategory ?? []}
                  totalComplaints={totalComplaints}
                  onCategoryClick={(cat) => router.push(`/complaints?category=${cat}`)}
                />
              </Surface>
            </motion.div>

            {/* Recent Complaints Stream */}
            <motion.div variants={fadeScaleIn}>
              <Surface as="div" variant="card" padding="md">
                <SectionHeader
                  title="Recent Complaints"
                  subtitle={`${activeComplaints} active triage cases`}
                  actionLabel="All Cases"
                  onAction={() => router.push('/complaints')}
                />
                {sortedComplaints.length === 0 ? (
                  <PanelEmpty
                    icon={<CheckCircle2 className="h-10 w-10" />}
                    title="All clear"
                    description="No unresolved complaints."
                    action={{
                      label: 'New Complaint',
                      onClick: () => router.push('/complaints/new'),
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    {sortedComplaints.slice(0, 4).map((c) => {
                      const meta = complaintStatusMeta(c.status);
                      const isActive = c.status === 'open' || c.status === 'in_progress';
                      const daysAgo = getDaysAgo(c.createdAt);
                      const showAgeBadge = isActive && daysAgo >= 3;

                      return (
                        <div
                          key={c._id}
                          role="button"
                          tabIndex={0}
                          className={clsx(
                            surfaceNestedClass,
                            'group flex cursor-pointer items-center gap-3 p-3 transition-all duration-(--transition-duration)',
                            'hover:border-(--color-brand-200) hover:shadow-(--shadow-sm)',
                          )}
                          onClick={() => router.push(`/complaints/${c._id}`)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              router.push(`/complaints/${c._id}`);
                            }
                          }}
                        >
                          <div
                            className={clsx(
                              'h-2.5 w-2.5 flex-shrink-0 rounded-full',
                              c.status === 'open' &&
                              'animate-pulse bg-(--color-danger-500)',
                              c.status === 'in_progress' && 'bg-(--color-warning-500)',
                              c.status === 'resolved' && 'bg-(--color-success-500)',
                              c.status !== 'open' &&
                              c.status !== 'in_progress' &&
                              c.status !== 'resolved' &&
                              'bg-(--chart-bar-secondary)',
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-13 font-semibold text-(--color-text-primary) transition-colors group-hover:text-(--color-brand-600)">
                                {c.title}
                              </p>
                              {showAgeBadge && (
                                <span
                                  className={clsx(
                                    'flex-shrink-0 rounded-full border px-1.5 py-0.5 text-3xs font-bold',
                                    daysAgo > 7
                                      ? 'border-(--badge-danger-border) bg-(--badge-danger-bg) text-(--badge-danger-text)'
                                      : 'border-(--badge-warning-border) bg-(--badge-warning-bg) text-(--badge-warning-text)',
                                  )}
                                >
                                  {daysAgo}d
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-2xs font-medium text-(--color-text-muted)">
                              {c.tenantId?.userId?.name ?? 'Unknown'} · {formatDate(c.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            <StatusBadge variant={meta.variant} label={meta.label} />
                            {isActive && (
                              <ArrowRight className="h-3.5 w-3.5 text-(--color-text-muted) opacity-0 transition-opacity group-hover:opacity-100" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Surface>
            </motion.div>
          </div>

          {/* Column B: Resident Living Standards & Facility Health */}
          <div className="space-y-6">
            {/* Meal Quality Ledger */}
            <motion.div variants={fadeScaleIn}>
              <Surface as="div" variant="card" padding="md">
                <SectionHeader
                  title="Meal Quality & Resident Feedback"
                  subtitle="14-day rolling satisfaction score with SLA target benchmark"
                  actionLabel="View Menus"
                  onAction={() => router.push('/meals')}
                />
                {stats.mealFeedbackTrend.length === 0 ? (
                  <PanelEmpty
                    icon={<UtensilsCrossed className="h-10 w-10" />}
                    title="No meal feedback recorded"
                  />
                ) : (
                  <MealFeedbackLedger
                    trend={stats.mealFeedbackTrend}
                    averages={mealAvg}
                    onManageClick={() => router.push('/meals')}
                  />
                )}
              </Surface>
            </motion.div>

            {/* Facility Health & Timeline */}
            <motion.div variants={fadeScaleIn}>
              <Surface as="div" variant="card" padding="md">
                <SectionHeader
                  title="Facility Service Status & Activity"
                  subtitle={`${serviceTotal} checks monitored · ${stats.services.operational} operational`}
                  actionLabel="View Services"
                  onAction={() => router.push('/services')}
                />
                {serviceTotal === 0 ? (
                  <PanelEmpty
                    icon={<Wifi className="h-10 w-10" />}
                    title="No services configured"
                    action={{ label: 'Add Service', onClick: () => router.push('/services/new') }}
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
                            {stats.services.operational} Operational
                          </span>
                        </div>
                        {stats.services.degraded > 0 && (
                          <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--badge-warning-border) bg-(--badge-warning-bg) px-3 py-1.5">
                            <span className="h-2 w-2 rounded-full bg-(--color-warning-500)" />
                            <span className="text-12 font-bold text-(--badge-warning-text)">
                              {stats.services.degraded} Degraded
                            </span>
                          </div>
                        )}
                        {stats.services.down > 0 && (
                          <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--badge-danger-border) bg-(--badge-danger-bg) px-3 py-1.5">
                            <span className="h-2 w-2 rounded-full bg-(--color-danger-500)" />
                            <span className="text-12 font-bold text-(--badge-danger-text)">
                              {stats.services.down} Outages
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {stats.serviceHistory && stats.serviceHistory.length > 0 && (
                      <div className="border-t border-(--border-color)/60 pt-3">
                        <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-(--color-text-muted)">
                          Recent Status Events (14 Days)
                        </p>
                        <div className="max-h-[160px] overflow-y-auto pr-1">
                          <Timeline
                            events={stats.serviceHistory.slice(0, 5).map((e) => ({
                              id: e.id,
                              date: e.date,
                              title: e.title,
                              description: e.description,
                              status: e.status as 'success' | 'warning' | 'danger',
                            }))}
                            maxHeight={160}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Surface>
            </motion.div>

            {/* Recent Enquiries */}
            <motion.div variants={fadeScaleIn}>
              <Surface as="div" variant="card" padding="md">
                <SectionHeader
                  title="Lead Inquiries Pipeline"
                  subtitle={`${stats.enquiries.pending} pending follow-up`}
                  actionLabel="View Pipeline"
                  onAction={() => router.push('/enquiries')}
                />
                {stats.recent.enquiries.length === 0 ? (
                  <PanelEmpty
                    icon={<PhoneCall className="h-10 w-10" />}
                    title="No recent enquiries"
                  />
                ) : (
                  <div className="space-y-2">
                    {stats.recent.enquiries.slice(0, 3).map((e) => (
                      <div
                        key={e._id}
                        role="button"
                        tabIndex={0}
                        className={clsx(
                          surfaceNestedClass,
                          'flex cursor-pointer items-center justify-between p-3 transition-all duration-(--transition-duration)',
                          'hover:border-(--color-brand-200) hover:shadow-(--shadow-sm)',
                        )}
                        onClick={() => router.push(`/enquiries/${e._id}`)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            router.push(`/enquiries/${e._id}`);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-13 font-semibold text-(--color-text-primary)">
                            {e.name}
                          </p>
                          <p className="mt-0.5 text-2xs font-medium text-(--color-text-muted)">
                            {e.phone} · {formatDate(e.createdAt)}
                          </p>
                        </div>
                        <StatusBadge
                          variant={
                            e.status === 'new'
                              ? 'warning'
                              : e.status === 'contacted'
                                ? 'info'
                                : 'success'
                          }
                          label={e.status.replace(/_/g, ' ')}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Surface>
            </motion.div>
          </div>
        </div>

        {/* Complaint Filing Heatmap Calendar (Clean, low-profile monthly calendar) */}
        {stats.complaintHeatmap && Object.keys(stats.complaintHeatmap).length > 0 && (
          <motion.div variants={fadeScaleIn}>
            <Surface as="div" variant="card" padding="md">
              <SectionHeader
                title="Monthly Incident Density Heatmap"
                subtitle="Click any active calendar date to jump directly to filtered complaints"
                actionLabel="View Calendar"
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
          </motion.div>
        )}
      </section>

      {/* ── Quick Jump Links ─────────────────────────────── */}
      <motion.nav
        aria-label="Quick management links"
        variants={fadeScaleIn}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { label: 'Tenants Directory', icon: <Users className="h-4 w-4" />, href: '/tenants' },
          { label: 'Payments & Dues', icon: <CreditCard className="h-4 w-4" />, href: '/payments' },
          { label: 'Rooms & Bed Grid', icon: <BedDouble className="h-4 w-4" />, href: '/rooms' },
          { label: 'Notice Board', icon: <AlertTriangle className="h-4 w-4" />, href: '/notices' },
        ].map((link) => (
          <button
            key={link.href}
            type="button"
            onClick={() => router.push(link.href)}
            className={clsx(
              'group flex items-center gap-2.5 px-4 py-3 text-13 font-semibold',
              'text-(--color-text-secondary)',
              'rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) shadow-(--shadow-xs)',
              'transition-all duration-(--transition-duration)',
              'hover:border-(--border-color-hover) hover:text-(--color-brand-600) hover:shadow-(--shadow-sm) focus:outline-none',
            )}
          >
            <span
              className="text-(--color-text-muted) transition-colors group-hover:text-(--color-brand-600)"
              aria-hidden="true"
            >
              {link.icon}
            </span>
            <span>{link.label}</span>
            <ArrowRight
              className="ml-auto h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
              aria-hidden="true"
            />
          </button>
        ))}
      </motion.nav>
    </motion.div>
  );
}
