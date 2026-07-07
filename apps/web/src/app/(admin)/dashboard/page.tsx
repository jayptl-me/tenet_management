'use client';

import { useState, useEffect } from 'react';
import { BedDouble, CreditCard, AlertTriangle, PhoneCall, TrendingUp, Wifi } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { BarChart, DonutChart, type ChartDataPoint } from '@/components/ui/ThemeChart';
import { Button } from '@/components/ui/Button';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

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

interface DashboardStats {
  occupancy: { totalRooms: number; occupiedBeds: number; vacancyRate: number };
  revenue: { collected: number; expected: number; month: string };
  complaints: { open: number; inProgress: number; resolved: number; dismissed: number };
  services: { operational: number; degraded: number; down: number };
  enquiries: { pending: number };
  recent: {
    complaints: Array<{
      _id: string;
      title: string;
      status: string;
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
  mealFeedbackTrend: MealFeedbackTrendPoint[];
}

// ── Helpers ────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (dateStr == null) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN');
  } catch {
    return dateStr;
  }
}

// ── Dashboard Page ─────────────────────────────────────

export default function DashboardPage() {
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

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // ── Error State ──────────────────────────────
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
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </motion.div>
    );
  }

  // ── Chart Data ───────────────────────────────
  const revenueChartData: ChartDataPoint[] = stats.revenueHistory.map((r) => ({
    label: r.month,
    value: r.collected,
    secondaryValue: r.expected,
  }));

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

  const serviceTotal =
    stats.services.operational + stats.services.degraded + stats.services.down;

  return (
    <motion.div
      variants={staggerContainerFast}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn}>
        <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Dashboard
        </h2>
        <p className="mt-1 text-[13px] font-medium text-[color:var(--color-text-muted)]">
          Overview for{' '}
          {new Date().toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </motion.div>

      {/* ── Stat Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Occupancy"
            value={`${stats.occupancy.occupiedBeds}/${stats.occupancy.totalRooms}`}
            icon={<BedDouble className="h-5 w-5" />}
            trend={{
              value: `${stats.occupancy.vacancyRate}%`,
              direction: 'neutral',
              label: 'vacancy rate',
            }}
            variant="default"
          />
        </motion.div>

        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Revenue Collected"
            value={`₹${stats.revenue.collected.toLocaleString()}`}
            icon={<CreditCard className="h-5 w-5" />}
            trend={{
              value: `${Math.round(
                (stats.revenue.collected / (stats.revenue.expected || 1)) * 100,
              )}%`,
              direction:
                stats.revenue.collected >= stats.revenue.expected * 0.8 ? 'up' : 'down',
              label: 'of expected',
            }}
            variant="success"
          />
        </motion.div>

        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Pending Enquiries"
            value={stats.enquiries.pending}
            icon={<PhoneCall className="h-5 w-5" />}
            variant={stats.enquiries.pending > 5 ? 'warning' : 'default'}
          />
        </motion.div>

        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Open Complaints"
            value={stats.complaints.open + stats.complaints.inProgress}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={{
              value: String(stats.complaints.resolved),
              direction: 'up',
              label: 'resolved',
            }}
            variant={stats.complaints.open > 3 ? 'danger' : 'warning'}
          />
        </motion.div>

        <motion.div variants={fadeScaleIn}>
          <StatCard
            title="Services Up"
            value={`${stats.services.operational}/${serviceTotal}`}
            icon={<TrendingUp className="h-5 w-5" />}
            variant={
              stats.services.down > 0
                ? 'danger'
                : stats.services.degraded > 0
                  ? 'warning'
                  : 'success'
            }
          />
        </motion.div>
      </div>

      {/* ── Charts Row ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Bar Chart */}
        <motion.section
          variants={fadeScaleIn}
          className="lg:col-span-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">
            Revenue — Last 6 Months
          </h3>
          {stats.revenueHistory.length === 0 ? (
            <p className="py-8 text-center text-[13px] font-medium text-[color:var(--color-text-muted)]">
              No revenue data available
            </p>
          ) : (
            <BarChart
              data={revenueChartData}
              height={260}
              variant="grouped"
              primaryLabel="Collected"
              secondaryLabel="Expected"
              showGrid
            />
          )}
        </motion.section>

        {/* Service Health */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">
            Service Health
          </h3>
          {serviceTotal === 0 ? (
            <p className="py-8 text-center text-[13px] font-medium text-[color:var(--color-text-muted)]">
              No services configured
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[color:var(--color-text-primary)]">
                    Services
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-surface-200)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--color-success-500)] transition-all duration-[var(--transition-duration-slow)] ease-[var(--transition-easing)]"
                      style={{
                        width: `${(stats.services.operational / serviceTotal) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px]">
                    <span className="font-bold text-[color:var(--color-success-700)]">
                      {stats.services.operational} Up
                    </span>
                    {stats.services.degraded > 0 && (
                      <span className="font-bold text-[color:var(--color-warning-700)]">
                        {stats.services.degraded} Degraded
                      </span>
                    )}
                    {stats.services.down > 0 && (
                      <span className="font-bold text-[color:var(--color-danger-700)]">
                        {stats.services.down} Down
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-around pt-2">
                <DonutChart
                  value={stats.services.operational}
                  max={serviceTotal}
                  size={56}
                  strokeWidth={5}
                  label={`${stats.services.operational}`}
                  sublabel="Operational"
                />
                <DonutChart
                  value={stats.services.down}
                  max={serviceTotal}
                  size={56}
                  strokeWidth={5}
                  label={`${stats.services.down}`}
                  sublabel="Down"
                />
              </div>
            </div>
          )}
        </motion.section>
      </div>

      {/* ── Meal Feedback ──────────────────────── */}
      {stats.mealFeedbackTrend.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
            <motion.div
              key={meal}
              variants={fadeScaleIn}
              className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 text-center shadow-[var(--shadow-card)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                {meal}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-[color:var(--color-text-primary)]">
                {mealAvg[meal]}
              </p>
              <p className="mt-1 text-[12px] font-medium text-[color:var(--color-text-muted)]">
                out of 5
              </p>
              <div className="mt-3 flex justify-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(mealAvg[meal])
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
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Recent Activity ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Complaints */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">
            Recent Complaints
          </h3>
          {stats.recent.complaints.length === 0 ? (
            <p className="py-8 text-center text-[13px] font-medium text-[color:var(--color-text-muted)]">
              No recent complaints
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recent.complaints.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between border-b border-b-[color:var(--color-surface-200)] py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                      {c.title}
                    </p>
                    <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                      {c.tenantId?.userId?.name ?? 'N/A'} | {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <StatusBadge
                    variant={statusToVariant(c.status)}
                    label={c.status.replace(/_/g, ' ')}
                  />
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Recent Enquiries */}
        <motion.section
          variants={fadeScaleIn}
          className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]"
        >
          <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">
            Recent Enquiries
          </h3>
          {stats.recent.enquiries.length === 0 ? (
            <p className="py-8 text-center text-[13px] font-medium text-[color:var(--color-text-muted)]">
              No recent enquiries
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recent.enquiries.map((e) => (
                <div
                  key={e._id}
                  className="flex items-center justify-between border-b border-b-[color:var(--color-surface-200)] py-2.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                      {e.name}
                    </p>
                    <p className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                      {e.phone} | {formatDate(e.createdAt)}
                    </p>
                  </div>
                  <StatusBadge
                    variant={statusToVariant(e.status)}
                    label={e.status.replace(/_/g, ' ')}
                  />
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
}
