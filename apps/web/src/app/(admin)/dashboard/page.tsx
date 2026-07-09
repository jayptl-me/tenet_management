'use client';

import { useState, useEffect } from 'react';
import {
  BedDouble, CreditCard, AlertTriangle, PhoneCall,
  Users, IndianRupee, CheckCircle2, Clock, Wifi, ArrowRight,
  UtensilsCrossed,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Sparkline } from '@/components/ui/Sparkline';
import { DonutChart } from '@/components/ui/DonutChart';
import { FunnelChart } from '@/components/ui/FunnelChart';
import { StackedBarChart } from '@/components/ui/StackedBarChart';
import { HeatmapCalendar } from '@/components/ui/HeatmapCalendar';
import { Timeline } from '@/components/ui/Timeline';
import { LineChart } from '@/components/ui/LineChart';
import { GaugeChart } from '@/components/ui/GaugeChart';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { ErrorState } from '@/components/ui/ErrorState';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';
import { surfaceNestedClass } from '@/lib/field-styles';
import { chartTokens } from '@/lib/chart-theme';
import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

interface RevenueHistoryPoint {
  month: string; collected: number; expected: number;
}

interface MealFeedbackTrendPoint {
  date: string; breakfast: number; lunch: number; dinner: number;
}

interface PaymentFunnelStage {
  count: number; totalAmount: number;
}

interface OccupancyHistoryPoint {
  month: string; occupied: number; total: number;
}

interface ServiceHistoryEvent {
  id: string; date: string; title: string; description: string; status: 'success' | 'warning' | 'danger';
}

interface DashboardStats {
  occupancy: { totalRooms: number; occupiedBeds: number; vacancyRate: number };
  revenue: { collected: number; expected: number; month: string };
  complaints: { open: number; inProgress: number; resolved: number; dismissed: number };
  services: { operational: number; degraded: number; down: number };
  enquiries: { pending: number };
  recent: {
    complaints: Array<{
      _id: string; title: string; status: string; category?: string;
      tenantId?: { userId?: { name: string } };
      createdAt: string;
    }>;
    enquiries: Array<{
      _id: string; name: string; phone: string; status: string; createdAt: string;
    }>;
  };
  revenueHistory: RevenueHistoryPoint[];
  occupancyHistory?: OccupancyHistoryPoint[];
  mealFeedbackTrend: MealFeedbackTrendPoint[];
  complaintsByCategory: Array<{ _id: string; count: number }>;
  paymentFunnel: Record<string, PaymentFunnelStage>;
  amenityHealth: Record<string, { operational: number; degraded: number; down: number; total: number }>;
  complaintHeatmap: Record<string, number>;
  serviceHistory?: ServiceHistoryEvent[];
}

// ── Helpers ────────────────────────────────────────────

const STATUS_PRIORITY: Record<string, number> = {
  open: 0, in_progress: 1, resolved: 2, dismissed: 3,
};

const CATEGORY_LABELS: Record<string, string> = {
  wifi: 'WiFi',
  water: 'Water',
  electricity: 'Electricity',
  food_quality: 'Food',
  cleaning_room: 'Room Cleaning',
  cleaning_washroom: 'Washroom',
  washing_machine: 'Washing Machine',
  fridge: 'Fridge',
  lights: 'Lights',
  noise: 'Noise',
  other: 'Other',
};

const CATEGORY_COLORS = [
  'var(--color-danger-500)',
  'var(--color-warning-500)',
  'var(--color-brand-500)',
  'var(--color-accent-500)',
  'var(--color-info-500)',
  'var(--color-success-500)',
];

const FUNNEL_COLORS: Record<string, string> = {
  draft: chartTokens.barSecondary,
  sent: 'var(--color-info-500)',
  partial: chartTokens.warning,
  paid: chartTokens.success,
  overdue: chartTokens.danger,
};

const FUNNEL_ORDER = ['paid', 'sent', 'partial', 'overdue', 'draft'];

function formatDate(dateStr: string | null | undefined): string {
  if (dateStr == null) return 'N/A';
  try { return new Date(dateStr).toLocaleDateString('en-IN'); } catch { return dateStr; }
}

function getDaysAgo(dateStr: string): number {
  const created = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function complaintStatusMeta(status: string): { variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string; icon: React.ReactNode } {
  switch (status) {
    case 'open': return { variant: 'danger', label: 'Open', icon: <AlertTriangle className="h-3 w-3" /> };
    case 'in_progress': return { variant: 'warning', label: 'In Progress', icon: <Clock className="h-3 w-3" /> };
    case 'resolved': return { variant: 'success', label: 'Resolved', icon: <CheckCircle2 className="h-3 w-3" /> };
    case 'dismissed': return { variant: 'neutral', label: 'Dismissed', icon: <CheckCircle2 className="h-3 w-3" /> };
    default: return { variant: 'neutral', label: status, icon: null };
  }
}

// ── Section Header ─────────────────────────────────────

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
        <h3 className="font-[family:var(--font-display)] text-base font-bold tracking-tight text-[color:var(--color-text-primary)] sm:text-[17px]">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-[color:var(--color-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="flex-shrink-0" onClick={onAction}>
          {actionLabel}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/** Compact empty state for use inside Surface panels (no nested card chrome). */
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
      <div className="mb-2 text-[color:var(--color-text-muted)]">{icon}</div>
      <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-[11px] font-medium leading-relaxed text-[color:var(--color-text-muted)]">
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
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('dashboard/stats')
      .json<{ success: boolean; data: DashboardStats }>()
      .then((res) => setStats(res.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setIsLoading(false));
  }, []);

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
  const totalComplaints = stats.complaints.open + stats.complaints.inProgress + stats.complaints.resolved + stats.complaints.dismissed;
  const activeComplaints = stats.complaints.open + stats.complaints.inProgress;
  const resolvedRate = totalComplaints > 0 ? Math.round((stats.complaints.resolved / totalComplaints) * 100) : 0;
  const collectionRate = stats.revenue.expected > 0 ? Math.round((stats.revenue.collected / stats.revenue.expected) * 100) : 0;
  const serviceTotal = stats.services.operational + stats.services.degraded + stats.services.down;
  const serviceHealthPct = serviceTotal > 0 ? Math.round((stats.services.operational / serviceTotal) * 100) : 100;
  const vacancyRate = Math.round(stats.occupancy.vacancyRate);

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
  const thisMonthCollected = momRevenueHistory.length > 0 ? momRevenueHistory[momRevenueHistory.length - 1].collected : 0;
  const lastMonthCollected = momRevenueHistory.length > 1 ? momRevenueHistory[momRevenueHistory.length - 2].collected : 0;
  // Only show delta when there's a meaningful prior-month baseline
  const momDelta =
    lastMonthCollected > 0
      ? Math.round(((thisMonthCollected - lastMonthCollected) / lastMonthCollected) * 100)
      : thisMonthCollected > 0
        ? null // this month has revenue but last month was 0 → use "New" label below
        : null;

  // Occupancy sparkline from real occupancyHistory (occupied beds), not revenue
  const occupancySparkline =
    (stats.occupancyHistory?.length ?? 0) > 0
      ? stats.occupancyHistory!.map((r) => r.occupied)
      : [stats.occupancy.occupiedBeds];

  // Meal feedback averages
  const mealAvg = {
    breakfast: stats.mealFeedbackTrend.length > 0
      ? Math.round((stats.mealFeedbackTrend.reduce((s, d) => s + d.breakfast, 0) / stats.mealFeedbackTrend.length) * 10) / 10
      : 0,
    lunch: stats.mealFeedbackTrend.length > 0
      ? Math.round((stats.mealFeedbackTrend.reduce((s, d) => s + d.lunch, 0) / stats.mealFeedbackTrend.length) * 10) / 10
      : 0,
    dinner: stats.mealFeedbackTrend.length > 0
      ? Math.round((stats.mealFeedbackTrend.reduce((s, d) => s + d.dinner, 0) / stats.mealFeedbackTrend.length) * 10) / 10
      : 0,
  };

  // Meal trend chart data
  const mealChartData = stats.mealFeedbackTrend.map((d) => ({
    breakfast: d.breakfast,
    lunch: d.lunch,
    dinner: d.dinner,
  }));
  const mealChartLabels = stats.mealFeedbackTrend.map((d) => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });

  // Complaints sorted by priority (open first)
  const sortedComplaints = [...stats.recent.complaints].sort(
    (a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99)
  );

  // Complaint categories for donut chart
  const complaintCategoryDonut = (stats.complaintsByCategory ?? []).map((cat, i) => ({
    label: CATEGORY_LABELS[cat._id] ?? cat._id,
    value: cat.count,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  // Payment funnel data
  const paymentFunnelStages = FUNNEL_ORDER
    .filter((key) => (stats.paymentFunnel?.[key]?.count ?? 0) > 0)
    .map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: stats.paymentFunnel?.[key]?.count ?? 0,
      color: FUNNEL_COLORS[key] ?? chartTokens.barSecondary,
    }));

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header ─────────────────────────────────── */}
      <PageHeader
        title="Dashboard"
        description={todayLabel}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/complaints/new')}>
              New Complaint
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/services')}>
              Manage Services
            </Button>
          </div>
        }
      />

      {/* ── KPI Row: 5 Key Metrics ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Occupancy"
            value={`${stats.occupancy.occupiedBeds}/${stats.occupancy.totalRooms}`}
            icon={<Users className="h-5 w-5" />}
            trend={{ value: `${vacancyRate}%`, direction: vacancyRate < 20 ? 'up' : 'down', label: 'vacant' }}
            variant="default"
            onClick={() => router.push('/tenants')}
          >
            <div className="mt-2">
              <Sparkline data={occupancySparkline} width={100} height={20} color={chartTokens.brand} />
            </div>
          </StatCard>
        </motion.div>
        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Collected (This Month)"
            value={`₹${stats.revenue.collected.toLocaleString()}`}
            icon={<IndianRupee className="h-5 w-5" />}
            trend={{ value: `${collectionRate}%`, direction: collectionRate >= 80 ? 'up' : 'down', label: 'of target' }}
            delta={momDelta != null ? {
              value: `${momDelta >= 0 ? '+' : ''}${momDelta}%`,
              direction: momDelta >= 0 ? 'up' : 'down',
              label: 'vs last month',
            } : undefined}
            variant={collectionRate >= 80 ? 'success' : 'warning'}
          />
        </motion.div>
        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Active Complaints"
            value={activeComplaints}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={{ value: String(stats.complaints.resolved), direction: 'up', label: 'resolved' }}
            variant={activeComplaints > 5 ? 'danger' : activeComplaints > 2 ? 'warning' : 'success'}
            onClick={() => router.push('/complaints')}
          />
        </motion.div>
        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Service Health"
            value={`${stats.services.operational}/${serviceTotal}`}
            icon={<Wifi className="h-5 w-5" />}
            trend={{ value: `${serviceHealthPct}%`, direction: serviceHealthPct >= 90 ? 'up' : 'down', label: 'operational' }}
            variant={stats.services.down > 0 ? 'danger' : stats.services.degraded > 0 ? 'warning' : 'success'}
            onClick={() => router.push('/services')}
          />
        </motion.div>
        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Pending Enquiries"
            value={stats.enquiries.pending}
            icon={<PhoneCall className="h-5 w-5" />}
            variant={stats.enquiries.pending > 5 ? 'warning' : 'default'}
            onClick={() => router.push('/enquiries')}
          />
        </motion.div>
      </div>

      {/* ── Charts Row: Revenue Line + Service Health Gauge ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Line Chart — 2/3 width */}
        <motion.div variants={fadeScaleIn} className="lg:col-span-2">
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Revenue Trend"
              subtitle={
                momDelta != null
                  ? `Last 6 months — collected vs expected · ${momDelta >= 0 ? '+' : ''}${momDelta}% MoM`
                  : 'Last 6 months — collected vs expected'
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
                height={240}
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

        {/* Service Health Gauge + Breakdown */}
        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="flex h-full flex-col">
            <SectionHeader
              title="Service Health"
              subtitle={`${serviceTotal} services across all floors`}
              actionLabel="View All"
              onAction={() => router.push('/services')}
            />
            {serviceTotal === 0 ? (
              <PanelEmpty
                icon={<Wifi className="h-10 w-10" />}
                title="No services configured"
                action={{ label: 'Add Service', onClick: () => router.push('/services/new') }}
              />
            ) : (
              <>
                <div className="mb-5 flex justify-center">
                  <GaugeChart
                    value={stats.services.operational}
                    max={serviceTotal}
                    size={130}
                    label="Operational"
                    sublabel={`${stats.services.operational} of ${serviceTotal} up`}
                    colorVar={serviceHealthPct === 100 ? '--color-success-500' : serviceHealthPct >= 70 ? '--color-warning-500' : '--color-danger-500'}
                  />
                </div>

                <div className="mb-1 flex flex-wrap justify-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-success-50)] px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-[color:var(--color-success-500)]" />
                    <span className="text-[11px] font-bold text-[color:var(--color-success-700)]">{stats.services.operational} Up</span>
                  </div>
                  {stats.services.degraded > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-warning-50)] px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-[color:var(--color-warning-500)]" />
                      <span className="text-[11px] font-bold text-[color:var(--color-warning-700)]">{stats.services.degraded} Degraded</span>
                    </div>
                  )}
                  {stats.services.down > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-danger-50)] px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-[color:var(--color-danger-500)]" />
                      <span className="text-[11px] font-bold text-[color:var(--color-danger-700)]">{stats.services.down} Down</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </Surface>
        </motion.div>
      </div>

      {/* ── Occupancy Trend ──────────────────────────── */}
      <motion.div variants={fadeScaleIn}>
        <Surface as="section" variant="card" padding="md">
          <SectionHeader
            title="Occupancy Trend"
            subtitle={stats.occupancyHistory && stats.occupancyHistory.length > 0
              ? 'Last 6 months — occupied vs total beds'
              : 'Occupancy data will appear as history is collected'}
            actionLabel="View Tenants"
            onAction={() => router.push('/tenants')}
          />
          {!stats.occupancyHistory || stats.occupancyHistory.length === 0 ? (
            <PanelEmpty
              icon={<Users className="h-10 w-10" />}
              title="No occupancy history yet"
              description={`Real-time snapshot: ${stats.occupancy.occupiedBeds} of ${stats.occupancy.totalRooms} beds filled`}
            />
          ) : (
            <LineChart
              data={stats.occupancyHistory.map((p) => ({ occupied: p.occupied, total: p.total }))}
              labels={stats.occupancyHistory.map((p) => {
                const [y, m] = p.month.split('-');
                return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short' });
              })}
              height={220}
              lines={[
                { key: 'occupied', color: chartTokens.brand, label: 'Occupied' },
                { key: 'total', color: chartTokens.barSecondary, label: 'Total Capacity' },
              ]}
              showGrid
              showLegend
            />
          )}
        </Surface>
      </motion.div>

      {/* ── Service Health History Timeline ── */}
      <motion.div variants={fadeScaleIn}>
        <Surface as="section" variant="card" padding="md">
          <SectionHeader
            title="Service Health History"
            subtitle={stats.serviceHistory && stats.serviceHistory.length > 0
              ? 'Last 14 days of service status changes'
              : 'Service status change tracking will appear here'}
            actionLabel="View Services"
            onAction={() => router.push('/services')}
          />
          {!stats.serviceHistory || stats.serviceHistory.length === 0 ? (
            <PanelEmpty
              icon={<Wifi className="h-10 w-10" />}
              title="No service events yet"
              description={`Currently ${stats.services.operational} operational, ${stats.services.degraded} degraded, ${stats.services.down} down`}
            />
          ) : (
            <div className="max-h-[300px] overflow-y-auto pr-1">
              <Timeline
                events={stats.serviceHistory.map((e) => ({
                  id: e.id,
                  date: e.date,
                  title: e.title,
                  description: e.description,
                  status: e.status as 'success' | 'warning' | 'danger',
                }))}
                maxHeight={280}
              />
            </div>
          )}
        </Surface>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Complaint Resolution Gauge + Stats */}
        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Complaint Resolution"
              subtitle={`${totalComplaints} total · ${resolvedRate}% resolved`}
              actionLabel="View All"
              onAction={() => router.push('/complaints')}
            />
            {totalComplaints === 0 ? (
              <PanelEmpty
                icon={<CheckCircle2 className="h-10 w-10" />}
                title="No complaints yet"
              />
            ) : (
              <div className="flex items-center justify-center gap-6">
                <GaugeChart
                  value={stats.complaints.resolved}
                  max={totalComplaints}
                  size={120}
                  label="Resolved"
                  sublabel={`${stats.complaints.resolved} of ${totalComplaints}`}
                  colorVar={resolvedRate >= 70 ? '--color-success-500' : resolvedRate >= 40 ? '--color-warning-500' : '--color-danger-500'}
                />
                <div className="min-w-[140px] flex-1 space-y-3">
                  {[
                    { label: 'Open', count: stats.complaints.open, color: chartTokens.danger },
                    { label: 'In Progress', count: stats.complaints.inProgress, color: chartTokens.warning },
                    { label: 'Resolved', count: stats.complaints.resolved, color: chartTokens.success },
                    { label: 'Dismissed', count: stats.complaints.dismissed, color: chartTokens.barSecondary },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[color:var(--color-text-secondary)]">{item.label}</span>
                        <span className="font-mono text-[11px] font-bold tabular-nums text-[color:var(--color-text-primary)]">{item.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--chart-track)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: totalComplaints > 0 ? `${(item.count / totalComplaints) * 100}%` : '0%',
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Surface>
        </motion.div>

        {/* Payment Collection Funnel */}
        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Payment Collection Pipeline"
              subtitle="Current month invoice status breakdown"
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
                barHeight={28}
                barGap={8}
              />
            )}
          </Surface>
        </motion.div>
      </div>

      {/* ── Complaint Categories Donut + Meal Feedback ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Complaint Categories"
              subtitle={totalComplaints > 0 ? `Top ${complaintCategoryDonut.length} categories` : 'No complaints yet'}
              actionLabel="View All"
              onAction={() => router.push('/complaints')}
            />
            {complaintCategoryDonut.length === 0 ? (
              <PanelEmpty
                icon={<CheckCircle2 className="h-10 w-10" />}
                title="All clear"
                description="No complaints logged in this period."
              />
            ) : (
              <DonutChart
                segments={complaintCategoryDonut}
                centerLabel={String(totalComplaints)}
                sublabel="total"
                size={170}
                thickness={32}
              />
            )}
          </Surface>
        </motion.div>

        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Meal Feedback"
              subtitle="14-day rolling average"
              actionLabel="View All"
              onAction={() => router.push('/meals')}
            />
            {stats.mealFeedbackTrend.length === 0 ? (
              <PanelEmpty
                icon={<UtensilsCrossed className="h-10 w-10" />}
                title="No meal feedback yet"
              />
            ) : (
              <>
                <LineChart
                  data={mealChartData}
                  labels={mealChartLabels.length > 7
                    ? mealChartLabels.filter((_, i) => i % Math.ceil(mealChartLabels.length / 6) === 0)
                    : mealChartLabels}
                  height={140}
                  lines={[
                    { key: 'breakfast', color: chartTokens.warning, label: 'Breakfast' },
                    { key: 'lunch', color: chartTokens.brand, label: 'Lunch' },
                    { key: 'dinner', color: chartTokens.success, label: 'Dinner' },
                  ]}
                  showGrid={false}
                  showLegend
                />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => {
                    const score = mealAvg[meal];
                    const pct = (score / 5) * 100;
                    return (
                      <div
                        key={meal}
                        className={clsx(surfaceNestedClass, 'p-3 text-center')}
                      >
                        <p className="text-[11px] font-semibold capitalize text-[color:var(--color-text-secondary)]">
                          {meal}
                        </p>
                        <p className={clsx(
                          'mt-1 text-xl font-bold tabular-nums',
                          pct >= 60 ? 'text-[color:var(--color-success-600)]'
                            : pct >= 30 ? 'text-[color:var(--color-warning-600)]'
                            : 'text-[color:var(--color-danger-600)]',
                        )}>
                          {score}
                        </p>
                        <p className="text-[10px] font-medium text-[color:var(--color-text-muted)]">/ 5</p>
                        <div className="mt-1 flex justify-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <svg
                              key={i}
                              className={clsx(
                                'h-3 w-3',
                                i < Math.round(score)
                                  ? 'text-[color:var(--color-warning-500)]'
                                  : 'text-[color:var(--chart-track)]',
                              )}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Surface>
        </motion.div>
      </div>

      {/* ── Amenity Health + Complaint Heatmap ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Amenity Health Breakdown"
              subtitle={`${Object.keys(stats.amenityHealth ?? {}).length} services tracked`}
              actionLabel="View All"
              onAction={() => router.push('/services')}
            />
            {!stats.amenityHealth || Object.keys(stats.amenityHealth).length === 0 ? (
              <PanelEmpty
                icon={<Wifi className="h-10 w-10" />}
                title="No amenities configured"
                action={{ label: 'Add Service', onClick: () => router.push('/services/new') }}
              />
            ) : (
              <StackedBarChart
                bars={Object.entries(stats.amenityHealth).map(([key, data]) => ({
                  label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                  segments: [
                    { value: data.operational, color: chartTokens.success, label: 'Operational' },
                    { value: data.degraded, color: chartTokens.warning, label: 'Degraded' },
                    { value: data.down, color: chartTokens.danger, label: 'Down' },
                  ].filter((s) => s.value > 0),
                }))}
                barHeight={28}
                barGap={10}
              />
            )}
          </Surface>
        </motion.div>

        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Complaint Activity"
              subtitle="Daily complaint filings this month"
              actionLabel="View All"
              onAction={() => router.push('/complaints')}
            />
            {!stats.complaintHeatmap || Object.keys(stats.complaintHeatmap).length === 0 ? (
              <PanelEmpty
                icon={<CheckCircle2 className="h-10 w-10" />}
                title="No complaints this month"
              />
            ) : (
              <div className="flex justify-center">
                <HeatmapCalendar
                  data={stats.complaintHeatmap}
                  year={new Date().getFullYear()}
                  month={new Date().getMonth()}
                  colorScale="danger"
                  size={14}
                  onDayClick={(_date, count) => {
                    if (count > 0) router.push('/complaints');
                  }}
                />
              </div>
            )}
          </Surface>
        </motion.div>
      </div>

      {/* ── Recent Activity: Complaints + Enquiries ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Recent Complaints"
              subtitle={`${activeComplaints} active · ${stats.complaints.resolved} resolved`}
              actionLabel="View All"
              onAction={() => router.push('/complaints')}
            />
            {sortedComplaints.length === 0 ? (
              <PanelEmpty
                icon={<CheckCircle2 className="h-10 w-10" />}
                title="All clear"
                description="No recent complaints."
                action={{ label: 'New Complaint', onClick: () => router.push('/complaints/new') }}
              />
            ) : (
              <div className="space-y-2">
                {sortedComplaints.map((c) => {
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
                        'group flex cursor-pointer items-center gap-3 p-3 transition-all duration-[var(--transition-duration)]',
                        'hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-sm)]',
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
                          c.status === 'open' && 'animate-pulse bg-[color:var(--color-danger-500)]',
                          c.status === 'in_progress' && 'bg-[color:var(--color-warning-500)]',
                          c.status === 'resolved' && 'bg-[color:var(--color-success-500)]',
                          c.status !== 'open' && c.status !== 'in_progress' && c.status !== 'resolved' && 'bg-[color:var(--chart-bar-secondary)]',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-[color:var(--color-text-primary)] transition-colors group-hover:text-[color:var(--color-brand-600)]">
                            {c.title}
                          </p>
                          {showAgeBadge && (
                            <span
                              className={clsx(
                                'flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                                daysAgo > 7
                                  ? 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]'
                                  : 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]',
                              )}
                            >
                              {daysAgo}d
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
                          {c.tenantId?.userId?.name ?? 'Unknown'} · {formatDate(c.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        <StatusBadge variant={meta.variant} label={meta.label} />
                        {isActive && (
                          <ArrowRight className="h-3.5 w-3.5 text-[color:var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Surface>
        </motion.div>

        <motion.div variants={fadeScaleIn}>
          <Surface as="section" variant="card" padding="md" className="h-full">
            <SectionHeader
              title="Recent Enquiries"
              subtitle={`${stats.enquiries.pending} pending`}
              actionLabel="View All"
              onAction={() => router.push('/enquiries')}
            />
            {stats.recent.enquiries.length === 0 ? (
              <PanelEmpty
                icon={<PhoneCall className="h-10 w-10" />}
                title="No recent enquiries"
              />
            ) : (
              <div className="space-y-2">
                {stats.recent.enquiries.map((e) => (
                  <div
                    key={e._id}
                    role="button"
                    tabIndex={0}
                    className={clsx(
                      surfaceNestedClass,
                      'flex cursor-pointer items-center justify-between p-3 transition-all duration-[var(--transition-duration)]',
                      'hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-sm)]',
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
                      <p className="truncate text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                        {e.name}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-[color:var(--color-text-muted)]">
                        {e.phone} · {formatDate(e.createdAt)}
                      </p>
                    </div>
                    <StatusBadge
                      variant={e.status === 'new' ? 'warning' : e.status === 'contacted' ? 'info' : 'success'}
                      label={e.status.replace(/_/g, ' ')}
                    />
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </motion.div>
      </div>

      {/* ── Activity Timeline ─────────────────────── */}
      <motion.div variants={fadeScaleIn}>
        <Surface as="section" variant="card" padding="md">
          <SectionHeader
            title="Activity Timeline"
            subtitle="Recent system events and updates"
            actionLabel="View Audit Logs"
            onAction={() => router.push('/audit-logs')}
          />
          <div className="max-h-[320px] overflow-y-auto pr-1">
            <Timeline
              events={[
                ...sortedComplaints.slice(0, 5).map((c) => ({
                  id: `complaint-${c._id}`,
                  date: c.createdAt,
                  title: `Complaint: ${c.title}`,
                  description: `${c.tenantId?.userId?.name ?? 'Unknown'} · ${c.category ?? 'General'}`,
                  status: c.status === 'open' ? 'danger' as const
                    : c.status === 'in_progress' ? 'warning' as const
                    : c.status === 'resolved' ? 'success' as const
                    : 'neutral' as const,
                })),
                ...stats.recent.enquiries.slice(0, 3).map((e) => ({
                  id: `enquiry-${e._id}`,
                  date: e.createdAt,
                  title: `Enquiry: ${e.name}`,
                  description: `${e.phone} · ${e.status.replace(/_/g, ' ')}`,
                  status: e.status === 'new' ? 'info' as const
                    : e.status === 'contacted' ? 'info' as const
                    : 'success' as const,
                })),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)}
              maxHeight={280}
            />
          </div>
        </Surface>
      </motion.div>

      {/* ── Quick Links Row ───────────────────────── */}
      <motion.div
        variants={fadeScaleIn}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { label: 'Tenants', icon: <Users className="h-4 w-4" />, href: '/tenants' },
          { label: 'Payments', icon: <CreditCard className="h-4 w-4" />, href: '/payments' },
          { label: 'Rooms', icon: <BedDouble className="h-4 w-4" />, href: '/rooms' },
          { label: 'Notices', icon: <AlertTriangle className="h-4 w-4" />, href: '/notices' },
        ].map((link) => (
          <button
            key={link.href}
            type="button"
            onClick={() => router.push(link.href)}
            className={clsx(
              'group flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold',
              'text-[color:var(--color-text-secondary)]',
              'rounded-[var(--radius-lg)] border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-xs)]',
              'transition-all duration-[var(--transition-duration)]',
              'hover:border-[color:var(--color-brand-200)] hover:text-[color:var(--color-brand-600)] hover:shadow-[var(--shadow-sm)]',
            )}
          >
            {link.icon}
            {link.label}
            <ArrowRight className="ml-auto h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
