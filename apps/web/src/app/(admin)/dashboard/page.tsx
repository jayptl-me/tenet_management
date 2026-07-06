'use client';

import { useState, useEffect } from 'react';
import { Users, BedDouble, CreditCard, AlertTriangle, PhoneCall, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

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
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="border-danger-500 bg-danger-100 rounded-lg border-[length:var(--bw-strong)] p-6 text-center">
        <p className="font-display text-danger-800 text-lg font-semibold">
          {error || 'Failed to load dashboard'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-surface-900 text-2xl font-extrabold">Dashboard</h2>
        <p className="text-surface-500 mt-0.5 text-sm">
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
          value={`${stats.services.operational}/${stats.services.operational + stats.services.degraded + stats.services.down}`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant={
            stats.services.down > 0 ? 'danger' : stats.services.degraded > 0 ? 'warning' : 'success'
          }
        />
      </div>

      {/* Revenue Chart */}
      <section className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">
          Revenue — Last 6 Months
        </h3>
        {stats.revenueHistory.length === 0 ? (
          <p className="text-surface-400 py-4 text-center text-sm">No revenue data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.revenueHistory} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: 'sans-serif' }} />
              <YAxis
                tick={{ fontSize: 12, fontFamily: 'sans-serif' }}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [`₹${value.toLocaleString()}`, undefined]}
                contentStyle={{
                  border: '2px solid #000',
                  borderRadius: 8,
                  fontFamily: 'sans-serif',
                }}
              />
              <Legend wrapperStyle={{ fontFamily: 'sans-serif', fontSize: 13 }} />
              <Bar dataKey="expected" name="Expected" fill="#A8A29E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Meal Feedback Trend */}
      <section className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">
          Meal Feedback — Last 14 Days
        </h3>
        {stats.mealFeedbackTrend.length === 0 ? (
          <p className="text-surface-400 py-4 text-center text-sm">
            No meal feedback data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats.mealFeedbackTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fontFamily: 'sans-serif' }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12, fontFamily: 'sans-serif' }} />
              <Tooltip
                formatter={(value: number) => [`${value} ★`, undefined]}
                labelFormatter={(label: string) =>
                  new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                }
                contentStyle={{
                  border: '2px solid #000',
                  borderRadius: 8,
                  fontFamily: 'sans-serif',
                }}
              />
              <Legend wrapperStyle={{ fontFamily: 'sans-serif', fontSize: 13 }} />
              <Line
                type="monotone"
                dataKey="breakfast"
                name="Breakfast"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="lunch"
                name="Lunch"
                stroke="#84CC16"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="dinner"
                name="Dinner"
                stroke="#6366F1"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Complaints */}
        <section className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">
            Recent Complaints
          </h3>
          {stats.recent.complaints.length === 0 ? (
            <p className="text-surface-400 py-4 text-center text-sm">No recent complaints</p>
          ) : (
            <div className="space-y-3">
              {stats.recent.complaints.map((c) => (
                <div
                  key={c._id}
                  className="border-surface-200 flex items-center justify-between border-b-2 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-surface-800 truncate text-sm font-semibold">{c.title}</p>
                    <p className="text-surface-400 text-xs">
                      {c.tenantId?.userId?.name ?? 'N/A'} •{' '}
                      {new Date(c.createdAt).toLocaleDateString('en-IN')}
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
        </section>

        {/* Recent Enquiries */}
        <section className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Recent Enquiries</h3>
          {stats.recent.enquiries.length === 0 ? (
            <p className="text-surface-400 py-4 text-center text-sm">No recent enquiries</p>
          ) : (
            <div className="space-y-3">
              {stats.recent.enquiries.map((e) => (
                <div
                  key={e._id}
                  className="border-surface-200 flex items-center justify-between border-b-2 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-surface-800 truncate text-sm font-semibold">{e.name}</p>
                    <p className="text-surface-400 text-xs">
                      {e.phone} • {new Date(e.createdAt).toLocaleDateString('en-IN')}
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
        </section>
      </div>
    </div>
  );
}
