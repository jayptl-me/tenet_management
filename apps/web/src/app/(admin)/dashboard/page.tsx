'use client';

import { useState, useEffect } from 'react';
import { Users, BedDouble, CreditCard, AlertTriangle, PhoneCall, TrendingUp, Wifi, Zap, Droplets } from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { BarChart, DonutChart, Sparkline, type ChartDataPoint } from '@/components/ui/ThemeChart';

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

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  try {
    return '₹' + amount.toLocaleString('en-IN');
  } catch {
    return '₹' + amount;
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (dateStr == null) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN');
  } catch {
    return dateStr;
  }
}

function getBrutalistStatusClass(status: string): string {
  const variant = statusToVariant(status);
  switch (variant) {
    case 'success':
      return 'border-emerald-400 bg-emerald-50 text-emerald-700';
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-700';
    case 'danger':
      return 'border-red-400 bg-red-50 text-red-700';
    case 'info':
      return 'border-blue-400 bg-blue-50 text-blue-700';
    default:
      return 'border-gray-300 bg-gray-50 text-gray-700';
  }
}

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-6 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444] text-center">
        <p className="font-black text-lg">
          {error || 'Failed to load dashboard'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-800 bg-gray-900 px-5 py-2.5 font-black text-sm text-white shadow-[4px_4px_0px_0px_#d1d5db] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  // Prepare chart data
  const revenueChartData: ChartDataPoint[] = stats.revenueHistory.map((r) => ({
    label: r.month,
    value: r.collected,
    secondaryValue: r.expected,
  }));

  // Meal feedback weekly averages
  const mealAvg = {
    breakfast: stats.mealFeedbackTrend.length > 0
      ? Math.round(stats.mealFeedbackTrend.reduce((s, d) => s + d.breakfast, 0) / stats.mealFeedbackTrend.length * 10) / 10
      : 0,
    lunch: stats.mealFeedbackTrend.length > 0
      ? Math.round(stats.mealFeedbackTrend.reduce((s, d) => s + d.lunch, 0) / stats.mealFeedbackTrend.length * 10) / 10
      : 0,
    dinner: stats.mealFeedbackTrend.length > 0
      ? Math.round(stats.mealFeedbackTrend.reduce((s, d) => s + d.dinner, 0) / stats.mealFeedbackTrend.length * 10) / 10
      : 0,
  };

  const complaintTotal = stats.complaints.open + stats.complaints.inProgress + stats.complaints.resolved + stats.complaints.dismissed;
  const serviceTotal = stats.services.operational + stats.services.degraded + stats.services.down;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-black text-2xl text-gray-900 tracking-tight">Dashboard</h2>
        <p className="text-gray-500 mt-0.5 text-sm font-semibold">
          Overview for {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Occupancy"
          value={`${stats.occupancy.occupiedBeds}/${stats.occupancy.totalRooms}`}
          icon={<BedDouble className="h-5 w-5" />}
          trend={{
            value: `${stats.occupancy.vacancyRate}%`,
            direction: 'up',
            label: 'vacancy rate',
          }}
          variant="default"
        />

        <StatCard
          title="Revenue Collected"
          value={`₹${stats.revenue.collected.toLocaleString()}`}
          icon={<CreditCard className="h-5 w-5" />}
          trend={{
            value: `${Math.round((stats.revenue.collected / (stats.revenue.expected || 1)) * 100)}%`,
            direction: stats.revenue.collected >= stats.revenue.expected * 0.8 ? 'up' : 'down',
            label: 'of expected',
          }}
          variant="success"
        />

        <StatCard
          title="Pending Enquiries"
          value={stats.enquiries.pending}
          icon={<PhoneCall className="h-5 w-5" />}
          variant={stats.enquiries.pending > 5 ? 'warning' : 'default'}
        />

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

        <StatCard
          title="Services Up"
          value={`${stats.services.operational}/${serviceTotal}`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant={
            stats.services.down > 0 ? 'danger' : stats.services.degraded > 0 ? 'warning' : 'success'
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Bar Chart */}
        <section className="lg:col-span-2 rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4">
            Revenue — Last 6 Months
          </h3>
          {stats.revenueHistory.length === 0 ? (
            <p className="text-gray-400 py-4 text-center text-sm font-semibold">No revenue data available</p>
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
        </section>

        {/* Service Health Donuts */}
        <section className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4">
            Service Health
          </h3>
          {serviceTotal === 0 ? (
            <p className="text-gray-400 py-4 text-center text-sm font-semibold">No services configured</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Wifi className="text-gray-700 h-5 w-5" />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-gray-800">Services</p>
                  <div className="bg-gray-200 mt-1 h-2 rounded-full overflow-hidden border border-gray-300">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(stats.services.operational / serviceTotal) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="text-emerald-700 font-black">{stats.services.operational} Up</span>
                    {stats.services.degraded > 0 && (
                      <span className="text-amber-700 font-black">{stats.services.degraded} Degraded</span>
                    )}
                    {stats.services.down > 0 && (
                      <span className="text-red-700 font-black">{stats.services.down} Down</span>
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
        </section>
      </div>

      {/* Meal Feedback Summary */}
      {stats.mealFeedbackTrend.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db] text-center">
            <p className="text-gray-500 font-black text-xs uppercase tracking-wider">Breakfast</p>
            <p className="font-black text-3xl text-gray-900 mt-2">{mealAvg.breakfast}</p>
            <p className="text-gray-400 text-xs mt-1 font-semibold">out of 5</p>
            <div className="mt-3 flex justify-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`h-4 w-4 ${i < Math.round(mealAvg.breakfast) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db] text-center">
            <p className="text-gray-500 font-black text-xs uppercase tracking-wider">Lunch</p>
            <p className="font-black text-3xl text-gray-900 mt-2">{mealAvg.lunch}</p>
            <p className="text-gray-400 text-xs mt-1 font-semibold">out of 5</p>
            <div className="mt-3 flex justify-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`h-4 w-4 ${i < Math.round(mealAvg.lunch) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db] text-center">
            <p className="text-gray-500 font-black text-xs uppercase tracking-wider">Dinner</p>
            <p className="font-black text-3xl text-gray-900 mt-2">{mealAvg.dinner}</p>
            <p className="text-gray-400 text-xs mt-1 font-semibold">out of 5</p>
            <div className="mt-3 flex justify-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={`h-4 w-4 ${i < Math.round(mealAvg.dinner) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Complaints */}
        <section className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4">
            Recent Complaints
          </h3>
          {stats.recent.complaints.length === 0 ? (
            <p className="text-gray-400 py-4 text-center text-sm font-semibold">No recent complaints</p>
          ) : (
            <div className="space-y-3">
              {stats.recent.complaints.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between border-b-2 border-gray-200 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800 truncate text-sm font-bold">{c.title}</p>
                    <p className="text-gray-400 text-xs font-semibold">
                      {c.tenantId?.userId?.name ?? 'N/A'} | {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border-2 px-2.5 py-0.5 text-xs font-black ${getBrutalistStatusClass(c.status)}`}
                  >
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Enquiries */}
        <section className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
          <h3 className="font-black text-lg text-gray-900 mb-4">Recent Enquiries</h3>
          {stats.recent.enquiries.length === 0 ? (
            <p className="text-gray-400 py-4 text-center text-sm font-semibold">No recent enquiries</p>
          ) : (
            <div className="space-y-3">
              {stats.recent.enquiries.map((e) => (
                <div
                  key={e._id}
                  className="flex items-center justify-between border-b-2 border-gray-200 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800 truncate text-sm font-bold">{e.name}</p>
                    <p className="text-gray-400 text-xs font-semibold">
                      {e.phone} | {formatDate(e.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border-2 px-2.5 py-0.5 text-xs font-black ${getBrutalistStatusClass(e.status)}`}
                  >
                    {e.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}