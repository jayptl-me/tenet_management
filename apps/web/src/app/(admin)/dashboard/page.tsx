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
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

// ── Chart Components (inline to this file) ──────────────

/** Format a number as a compact currency label (₹, K, L) */
function formatCurrencyLabel(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}K`;
  return `₹${Math.round(n)}`;
}

/** Interactive HTML/CSS bar chart — uses explicit pixel heights for correct data scaling */
function LineChart({
  data,
  labels,
  lines,
  showGrid = true,
  isCurrency = false,
}: {
  data: Array<Record<string, number>>;
  labels: string[];
  height?: number;
  lines: Array<{ key: string; color: string; label: string }>;
  showGrid?: boolean;
  showDots?: boolean;
  isCurrency?: boolean;
}) {
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
  const chartAreaH = 200; // fixed chart height in px for consistent scaling
  const baselineH = 24;   // space below chart for x-axis labels
  const yLabelW = 64;     // width reserved for y-axis labels (fits ₹39K)

  const allValues = data.flatMap((d) => lines.map((l) => d[l.key] ?? 0));
  const rawMax = Math.max(...allValues, 1);
  // Add 20% headroom so tallest bar doesn't touch top of chart
  const maxVal = rawMax * 1.2;
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  // Compute per-bar heights in pixels
  const bars = data.map((d) =>
    lines.map((line) => {
      const val = d[line.key] ?? 0;
      const h = range > 0 ? ((val - minVal) / range) * chartAreaH : 0;
      return { key: line.key, color: line.color, height: Math.max(h, val > 0 ? 4 : 0), value: val };
    })
  );

  // Smart label sampling
  const maxVisibleLabels = 7;
  const labelInterval = data.length <= maxVisibleLabels ? 1 : Math.ceil(data.length / maxVisibleLabels);

  // Y-axis grid: 5 evenly-spaced pixel positions + values
  const gridCount = 4;
  const gridRows = Array.from({ length: gridCount + 1 }, (_, i) => {
    const y = chartAreaH - (i / gridCount) * chartAreaH;
    const rawVal = minVal + range * (i / gridCount);
    return { y, value: rawVal };
  });

  return (
    <div className="w-full">
      <div className="flex gap-0">
        {/* Y-axis */}
        {showGrid && (
          <div className="relative flex-shrink-0 overflow-visible" style={{ width: yLabelW, height: chartAreaH }}>
            {gridRows.map((gr, i) => (
              <div key={i} className="absolute right-0 text-right" style={{ top: gr.y, transform: 'translateY(-50%)' }}>
                <span className="text-[10px] font-mono font-medium text-[color:var(--color-text-muted)] leading-none tabular-nums whitespace-nowrap">
                  {isCurrency ? formatCurrencyLabel(gr.value) : Math.round(gr.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Chart area */}
        <div className="flex-1 relative" style={{ height: chartAreaH + baselineH }}>
          {/* Grid lines */}
          {showGrid && gridRows.map((gr, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-[color:var(--border-color)] pointer-events-none"
              style={{ top: gr.y, opacity: i === gridCount ? 0.8 : 0.4, borderStyle: i === gridCount ? 'solid' : 'dashed' }}
            />
          ))}

          {/* Bars container — absolute-positioned bars per month, growing upward from baseline */}
          <div className="flex items-end gap-[6px] sm:gap-2" style={{ height: chartAreaH, paddingBottom: 0 }}>
            {bars.map((barGroup, i) => (
              <div
                key={i}
                className="flex-1 relative cursor-pointer"
                style={{ height: chartAreaH, minWidth: 24 }}
                onMouseEnter={() => setTooltipIdx(i)}
                onMouseLeave={() => setTooltipIdx(null)}
              >
                {/* Bars positioned at the bottom baseline */}
                <div className="absolute bottom-0 left-0 right-0 flex flex-row items-end justify-center gap-[2px]">
                  {barGroup.map((seg) => (
                    <div
                      key={seg.key}
                      className="flex-1 rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${seg.height}px`,
                        minHeight: seg.value > 0 ? '4px' : '0px',
                        backgroundColor: seg.color,
                        opacity: tooltipIdx === i ? 1 : 0.85,
                      }}
                    />
                  ))}
                </div>
                {/* Tooltip */}
                {tooltipIdx === i && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 pointer-events-none">
                    <div
                      className="rounded-lg px-3 py-2 shadow-[var(--shadow-dropdown)] text-center whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--tooltip-bg, var(--color-surface-900))',
                        borderRadius: 'var(--tooltip-radius, 8px)',
                      }}
                    >
                      <p className="text-[11px] font-bold leading-tight" style={{ color: 'var(--tooltip-text, var(--color-surface-50))' }}>{labels[i]}</p>
                      {barGroup.map((seg) => (
                        <p key={seg.key} className="text-[10px] font-medium leading-tight mt-0.5 opacity-90" style={{ color: 'var(--tooltip-text, var(--color-surface-50))' }}>
                          {seg.key}: {isCurrency ? formatCurrencyLabel(seg.value) : Math.round(seg.value)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="flex gap-[2px] sm:gap-1 mt-1">
            {labels.map((label, i) => {
              if (i % labelInterval !== 0 && i !== labels.length - 1) return <div key={i} className="flex-1 min-w-[20px]" />;
              return (
                <div key={i} className="flex-1 text-center min-w-[20px]">
                  <span className="text-[10px] font-medium text-[color:var(--color-text-muted)] leading-tight">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: line.color }} />
            <span className="text-[11px] font-semibold text-[color:var(--color-text-secondary)]">{line.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Radial gauge — shows a percentage value as a semi-circular gauge */
function GaugeChart({
  value,
  max = 100,
  size = 120,
  label,
  sublabel,
  colorVar = '--color-success-500',
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  sublabel?: string;
  colorVar?: string;
}) {
  const strokeW = 10;
  const radius = (size - strokeW) / 2;
  const circumference = Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <svg width={size} height={size / 2 + strokeW} viewBox={`0 0 ${size} ${size / 2 + strokeW}`}>
        <path
          d={`M ${strokeW / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeW / 2} ${size / 2}`}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        <path
          d={`M ${strokeW / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeW / 2} ${size / 2}`}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity={0.9}
          className="transition-all duration-700 ease-out"
        />
        <text
          x={center}
          y={size / 2 - 4}
          textAnchor="middle"
          fill="var(--color-text-primary)"
          fontSize={size * 0.18}
          fontFamily="var(--font-display)"
          fontWeight={700}
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      {label && (
        <span className="font-display text-xs font-bold text-[color:var(--color-text-primary)]">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
          {sublabel}
        </span>
      )}
    </div>
  );
}

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
  draft: 'var(--color-surface-400)',
  sent: 'var(--color-info-500)',
  partial: 'var(--color-warning-500)',
  paid: 'var(--color-success-500)',
  overdue: 'var(--color-danger-500)',
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
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] font-medium text-[color:var(--color-text-muted)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel} <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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
      <motion.div
        variants={fadeScaleIn}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-8 text-center shadow-[var(--shadow-md)]"
      >
        <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
        <p className="mt-3 text-[15px] font-bold text-[color:var(--color-danger-700)]">
          {error || 'Failed to load dashboard'}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </motion.div>
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

  // Occupancy sparkline data (from revenue history collected values as proxy)
  // In a real implementation this would be bed-occupancy-over-time; for now we approximate
  const occupancySparkline = stats.revenueHistory.map((r) => r.collected);

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
      color: FUNNEL_COLORS[key] ?? 'var(--color-surface-400)',
    }));

  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header with Quick Date ─────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Dashboard
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <Button variant="outline" size="sm" onClick={() => router.push('/complaints/new')}>
            + New Complaint
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/services')}>
            Manage Services
          </Button>
        </div>
      </motion.div>

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
              <Sparkline data={occupancySparkline} width={100} height={20} color="var(--color-brand-500)" />
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
        <motion.section
          variants={fadeScaleIn}
          className="lg:col-span-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-[color:var(--color-text-primary)]">
                Revenue Trend
              </h3>
              <p className="text-[11px] font-medium text-[color:var(--color-text-muted)] mt-0.5">
                Last 6 months — collected vs. expected
                {momDelta != null && (
                  <span className={`ml-2 font-semibold ${momDelta >= 0 ? 'text-[color:var(--color-success-600)]' : 'text-[color:var(--color-danger-600)]'}`}>
                    {momDelta >= 0 ? '↑' : '↓'} {Math.abs(momDelta)}% MoM
                  </span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/payments')}>
              View Payments
            </Button>
          </div>
          {stats.revenueHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IndianRupee className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No revenue data available yet
              </p>
            </div>
          ) : (
            <LineChart
              data={revenueChartData}
              labels={revenueLabels}
              height={240}
              lines={[
                { key: 'collected', color: 'var(--color-brand-500)', label: 'Collected' },
                { key: 'expected', color: 'var(--color-surface-300)', label: 'Expected' },
              ]}
              showGrid
              showDots
              isCurrency
            />
          )}
        </motion.section>

        {/* Service Health Gauge + Breakdown */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)] flex flex-col"
        >
          <SectionHeader
            title="Service Health"
            subtitle={`${serviceTotal} services across all floors`}
            actionLabel="View All"
            onAction={() => router.push('/services')}
          />
          {serviceTotal === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
              <Wifi className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No services configured
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/services/new')}>
                Add Service
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <GaugeChart
                  value={stats.services.operational}
                  max={serviceTotal}
                  size={130}
                  label="Operational"
                  sublabel={`${stats.services.operational} of ${serviceTotal} up`}
                  colorVar={serviceHealthPct === 100 ? '--color-success-500' : serviceHealthPct >= 70 ? '--color-warning-500' : '--color-danger-500'}
                />
              </div>

              <div className="flex justify-center gap-3 mb-5">
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
        </motion.section>
      </div>

      {/* ── Occupancy Trend (new G3 section) ──────────── */}
      <motion.section
        variants={fadeScaleIn}
        className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
      >
        <SectionHeader
          title="Occupancy Trend"
          subtitle={stats.occupancyHistory && stats.occupancyHistory.length > 0
            ? 'Last 6 months — occupied vs total beds'
            : 'Occupancy data will appear as history is collected'}
          actionLabel="View Tenants"
          onAction={() => router.push('/tenants')}
        />
        {!stats.occupancyHistory || stats.occupancyHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
            <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Occupancy history will track month-over-month bed utilization
            </p>
            <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1">
              Currently showing real-time snapshot: {stats.occupancy.occupiedBeds} of {stats.occupancy.totalRooms} beds filled
            </p>
          </div>
        ) : (
          <LineChart
            data={stats.occupancyHistory.map((p) => ({ occupied: p.occupied, total: p.total }))}
            labels={stats.occupancyHistory.map((p) => {
              const [y, m] = p.month.split('-');
              return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short' });
            })}
            height={220}
            lines={[
              { key: 'occupied', color: 'var(--color-brand-500)', label: 'Occupied' },
              { key: 'total', color: 'var(--color-surface-300)', label: 'Total Capacity' },
            ]}
            showGrid
            showDots
          />
        )}
      </motion.section>

      {/* ── Complaint Resolution + Payment Funnel ───── */}
      {/* ── Service Health History Timeline (new G4 section) ── */}
      <motion.section
        variants={fadeScaleIn}
        className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
      >
        <SectionHeader
          title="Service Health History"
          subtitle={stats.serviceHistory && stats.serviceHistory.length > 0
            ? 'Last 14 days of service status changes'
            : 'Service status change tracking will appear here'}
          actionLabel="View Services"
          onAction={() => router.push('/services')}
        />
        {!stats.serviceHistory || stats.serviceHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Wifi className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
            <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
              Service health timeline will track operational status changes over time
            </p>
            <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1">
              Currently {stats.services.operational} operational, {stats.services.degraded} degraded, {stats.services.down} down
            </p>
          </div>
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
      </motion.section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Complaint Resolution Gauge + Stats */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Complaint Resolution"
            subtitle={`${totalComplaints} total · ${resolvedRate}% resolved`}
            actionLabel="View All"
            onAction={() => router.push('/complaints')}
          />
          {totalComplaints === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No complaints yet
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-6 justify-center">
              <GaugeChart
                value={stats.complaints.resolved}
                max={totalComplaints}
                size={120}
                label="Resolved"
                sublabel={`${stats.complaints.resolved} of ${totalComplaints}`}
                colorVar={resolvedRate >= 70 ? '--color-success-500' : resolvedRate >= 40 ? '--color-warning-500' : '--color-danger-500'}
              />
              <div className="flex-1 space-y-3 min-w-[140px]">
                {[
                  { label: 'Open', count: stats.complaints.open, color: 'var(--color-danger-500)', bg: 'var(--color-danger-100)' },
                  { label: 'In Progress', count: stats.complaints.inProgress, color: 'var(--color-warning-500)', bg: 'var(--color-warning-100)' },
                  { label: 'Resolved', count: stats.complaints.resolved, color: 'var(--color-success-500)', bg: 'var(--color-success-100)' },
                  { label: 'Dismissed', count: stats.complaints.dismissed, color: 'var(--color-surface-400)', bg: 'var(--color-surface-100)' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-[color:var(--color-text-secondary)]">{item.label}</span>
                      <span className="text-[11px] font-bold font-mono text-[color:var(--color-text-primary)]">{item.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[color:var(--color-surface-200)] overflow-hidden">
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
        </motion.section>

        {/* Payment Collection Funnel — NEW */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Payment Collection Pipeline"
            subtitle="Current month invoice status breakdown"
            actionLabel="View Invoices"
            onAction={() => router.push('/invoices')}
          />
          {paymentFunnelStages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CreditCard className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No invoices this month
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/invoices/new')}>
                Create Invoice
              </Button>
            </div>
          ) : (
            <FunnelChart
              stages={paymentFunnelStages}
              maxWidth={100}
              barHeight={28}
              barGap={8}
            />
          )}
        </motion.section>
      </div>

      {/* ── Complaint Categories Donut + Meal Feedback ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Complaint Category Donut — NEW */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Complaint Categories"
            subtitle={totalComplaints > 0 ? `Top ${complaintCategoryDonut.length} categories` : 'No complaints yet'}
            actionLabel="View All"
            onAction={() => router.push('/complaints')}
          />
          {complaintCategoryDonut.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-[color:var(--color-success-300)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                All clear — no complaints
              </p>
            </div>
          ) : (
            <DonutChart
              segments={complaintCategoryDonut}
              centerLabel={String(totalComplaints)}
              sublabel="total"
              size={170}
              thickness={32}
            />
          )}
        </motion.section>

        {/* Meal Feedback Summary */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Meal Feedback"
            subtitle="14-day rolling average"
            actionLabel="View All"
            onAction={() => router.push('/meals')}
          />
          {stats.mealFeedbackTrend.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <UtensilsCrossed className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No meal feedback yet
              </p>
            </div>
          ) : (
            <>
              <LineChart
                data={mealChartData}
                labels={mealChartLabels.length > 7
                  ? mealChartLabels.filter((_, i) => i % Math.ceil(mealChartLabels.length / 6) === 0)
                  : mealChartLabels}
                height={140}
                lines={[
                  { key: 'breakfast', color: 'var(--color-warning-500)', label: 'Breakfast' },
                  { key: 'lunch', color: 'var(--color-brand-500)', label: 'Lunch' },
                  { key: 'dinner', color: 'var(--color-success-500)', label: 'Dinner' },
                ]}
                showGrid={false}
                showDots={false}
              />
              <div className="grid grid-cols-3 gap-3 mt-4">
                {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => {
                  const score = mealAvg[meal];
                  const pct = (score / 5) * 100;
                  return (
                    <div
                      key={meal}
                      className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-3 text-center"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        {meal}
                      </p>
                      <p className={`mt-1 text-xl font-bold tabular-nums ${
                        pct >= 60 ? 'text-[color:var(--color-success-600)]'
                          : pct >= 30 ? 'text-[color:var(--color-warning-600)]'
                          : 'text-[color:var(--color-danger-600)]'
                      }`}>
                        {score}
                      </p>
                      <p className="text-[10px] font-medium text-[color:var(--color-text-muted)]">/ 5</p>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg
                            key={i}
                            className={`h-3 w-3 ${
                              i < Math.round(score)
                                ? 'text-[color:var(--color-warning-500)]'
                                : 'text-[color:var(--color-surface-200)]'
                            }`}
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
        </motion.section>
      </div>

      {/* ── Amenity Health + Complaint Heatmap ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Amenity Health Stacked Bar Chart */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Amenity Health Breakdown"
            subtitle={`${Object.keys(stats.amenityHealth ?? {}).length} services tracked`}
            actionLabel="View All"
            onAction={() => router.push('/services')}
          />
          {!stats.amenityHealth || Object.keys(stats.amenityHealth).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Wifi className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No amenities configured
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/services/new')}>
                Add Service
              </Button>
            </div>
          ) : (
            <StackedBarChart
              bars={Object.entries(stats.amenityHealth).map(([key, data]) => ({
                label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                segments: [
                  { value: data.operational, color: 'var(--color-success-500)', label: 'Operational' },
                  { value: data.degraded, color: 'var(--color-warning-500)', label: 'Degraded' },
                  { value: data.down, color: 'var(--color-danger-500)', label: 'Down' },
                ].filter((s) => s.value > 0),
              }))}
              barHeight={28}
              barGap={10}
            />
          )}
        </motion.section>

        {/* Complaint Activity Heatmap */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Complaint Activity"
            subtitle="Daily complaint filings this month"
            actionLabel="View All"
            onAction={() => router.push('/complaints')}
          />
          {!stats.complaintHeatmap || Object.keys(stats.complaintHeatmap).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-[color:var(--color-success-300)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No complaints this month
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              <HeatmapCalendar
                data={stats.complaintHeatmap}
                year={new Date().getFullYear()}
                month={new Date().getMonth()}
                colorScale="danger"
                size={14}
                onDayClick={(date, count) => {
                  if (count > 0) router.push(`/complaints`);
                }}
              />
            </div>
          )}
        </motion.section>
      </div>

      {/* ── Recent Activity: Complaints + Enquiries ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Complaints — with age badges */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Recent Complaints"
            subtitle={`${activeComplaints} active · ${stats.complaints.resolved} resolved`}
            actionLabel="View All"
            onAction={() => router.push('/complaints')}
          />
          {sortedComplaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-[color:var(--color-success-300)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                All clear — no complaints
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/complaints/new')}>
                + New Complaint
              </Button>
            </div>
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
                    className="group flex items-center gap-3 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-3 transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-sm)] cursor-pointer"
                    onClick={() => router.push(`/complaints/${c._id}`)}
                  >
                    <div className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${
                      c.status === 'open' ? 'bg-[color:var(--color-danger-500)] animate-pulse'
                        : c.status === 'in_progress' ? 'bg-[color:var(--color-warning-500)]'
                        : c.status === 'resolved' ? 'bg-[color:var(--color-success-500)]'
                        : 'bg-[color:var(--color-surface-300)]'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-[color:var(--color-text-primary)] group-hover:text-[color:var(--color-brand-600)] transition-colors">
                          {c.title}
                        </p>
                        {showAgeBadge && (
                          <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            daysAgo > 7
                              ? 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-700)]'
                              : 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-700)]'
                          }`}>
                            {daysAgo}d
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-[color:var(--color-text-muted)] mt-0.5">
                        {c.tenantId?.userId?.name ?? 'Unknown'} · {formatDate(c.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <StatusBadge variant={meta.variant} label={meta.label} />
                      {isActive && (
                        <ArrowRight className="h-3.5 w-3.5 text-[color:var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Recent Enquiries */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <SectionHeader
            title="Recent Enquiries"
            subtitle={`${stats.enquiries.pending} pending`}
            actionLabel="View All"
            onAction={() => router.push('/enquiries')}
          />
          {stats.recent.enquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PhoneCall className="h-10 w-10 text-[color:var(--color-text-muted)] mb-2" />
              <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
                No recent enquiries
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recent.enquiries.map((e) => (
                <div
                  key={e._id}
                  className="flex items-center justify-between rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] p-3 transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-brand-200)] hover:shadow-[var(--shadow-sm)] cursor-pointer"
                  onClick={() => router.push(`/enquiries/${e._id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                      {e.name}
                    </p>
                    <p className="text-[11px] font-medium text-[color:var(--color-text-muted)] mt-0.5">
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
        </motion.section>
      </div>

      {/* ── Activity Timeline ─────────────────────── */}
      <motion.section
        variants={fadeScaleIn}
        className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
      >
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
      </motion.section>

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
            onClick={() => router.push(link.href)}
            className="group flex items-center gap-2 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-text-secondary)] shadow-[var(--shadow-xs)] transition-all duration-[var(--transition-duration)] hover:border-[color:var(--color-brand-200)] hover:text-[color:var(--color-brand-600)] hover:shadow-[var(--shadow-sm)]"
          >
            {link.icon}
            {link.label}
            <ArrowRight className="ml-auto h-3 w-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
