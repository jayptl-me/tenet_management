'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Search,
  Send,
  Users,
  Building2,
  DoorOpen,
  User,
  Filter,
  Megaphone,
  AlertTriangle,
  CreditCard,
  Check,
  MessageSquare,
  Wrench,
  Zap,
  Waves,
  Utensils,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { INotification, INotificationType } from '@pg/types';

type TargetFilter = 'all' | 'floor' | 'room' | 'individual';

interface NotificationForm {
  targetType: TargetFilter;
  targetIds: string[];
  title: string;
  body: string;
  type: INotificationType;
  sendPush: boolean;
}

const emptyForm: NotificationForm = {
  targetType: 'all',
  targetIds: [],
  title: '',
  body: '',
  type: 'announcement',
  sendPush: true,
};

const typeIconsMap: Record<INotificationType, React.ReactNode> = {
  announcement: <Megaphone className="h-4 w-4" />,
  emergency: <AlertTriangle className="h-4 w-4 text-danger-500" />,
  payment_reminder: <CreditCard className="h-4 w-4 text-warning-500" />,
  payment_verified: <Check className="h-4 w-4 text-success-500" />,
  complaint_update: <MessageSquare className="h-4 w-4" />,
  service_update: <Wrench className="h-4 w-4" />,
  electricity_bill: <Zap className="h-4 w-4" />,
  welcome: <Waves className="h-4 w-4" />,
  meal_feedback: <Utensils className="h-4 w-4" />,
};

const typeOptions: { value: INotificationType; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'payment_verified', label: 'Payment Verified' },
  { value: 'complaint_update', label: 'Complaint Update' },
  { value: 'service_update', label: 'Service Update' },
  { value: 'electricity_bill', label: 'Electricity Bill' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'meal_feedback', label: 'Meal Feedback' },
];

const typeColors: Record<string, string> = {
  emergency: 'bg-danger-100 text-danger-800',
  payment_verified: 'bg-success-100 text-success-800',
  payment_reminder: 'bg-warning-100 text-warning-800',
  welcome: 'bg-brand-100 text-brand-800',
};

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [form, setForm] = useState<NotificationForm>(emptyForm);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // History state
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterType, setFilterType] = useState<INotificationType | ''>('');
  const [filterTarget, setFilterTarget] = useState<TargetFilter | ''>('');

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (filterType) params.type = filterType;
      const res = await api.get('notifications', { searchParams: params }).json<{
        success: boolean;
        data: INotification[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>();
      setNotifications(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    setSendSuccess(false);
    try {
      await api
        .post('notifications', {
          json: form,
        })
        .json<{ success: boolean }>();
      setSendSuccess(true);
      setForm(emptyForm);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch {
      // Error handling via toast would be ideal; for now, silently handle
    } finally {
      setSending(false);
    }
  };

  const targetIcons: Record<TargetFilter, React.ReactNode> = {
    all: <Users className="h-4 w-4" />,
    floor: <Building2 className="h-4 w-4" />,
    room: <DoorOpen className="h-4 w-4" />,
    individual: <User className="h-4 w-4" />,
  };

  const targetLabels: Record<TargetFilter, string> = {
    all: 'All Tenants',
    floor: 'By Floor',
    room: 'By Room',
    individual: 'Specific Tenant',
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="font-display text-surface-900 text-2xl font-extrabold">Notifications</h2>
        <p className="text-surface-500 mt-0.5 text-sm">
          Broadcast announcements and manage notification history
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-surface-200 mb-6 flex gap-1 rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-1 shadow-[var(--shadow-button)]">
        <button
          onClick={() => setActiveTab('compose')}
          className={`font-display flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
            activeTab === 'compose'
              ? 'text-surface-900 bg-white shadow-[var(--shadow-button)]'
              : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          <Send className="mr-2 inline-block h-4 w-4" />
          Compose
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`font-display flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
            activeTab === 'history'
              ? 'text-surface-900 bg-white shadow-[var(--shadow-button)]'
              : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          <Bell className="mr-2 inline-block h-4 w-4" />
          History
        </button>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-6 shadow-[var(--shadow-card)]">
          <div className="grid gap-5">
            {/* Target Type */}
            <div>
              <label className="font-body text-surface-700 mb-2 block text-sm font-semibold">
                Target Audience
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(targetLabels) as TargetFilter[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, targetType: key, targetIds: [] })}
                    className={`font-body flex items-center justify-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] ${
                      form.targetType === key
                        ? 'bg-brand-500 text-white shadow-[var(--shadow-button)]'
                        : 'text-surface-600 hover:bg-surface-50 bg-white'
                    }`}
                  >
                    {targetIcons[key]}
                    {targetLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Target IDs (for non-"all" targets) */}
            {form.targetType !== 'all' && (
              <div>
                <label className="font-body text-surface-700 mb-2 block text-sm font-semibold">
                  {form.targetType === 'floor'
                    ? 'Floor IDs'
                    : form.targetType === 'room'
                      ? 'Room IDs'
                      : 'User IDs'}
                  <span className="text-surface-400 ml-1 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={form.targetIds.join(', ')}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      targetIds: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. floor-1, floor-2"
                  className="font-body focus:border-brand-500 focus:ring-brand-200 w-full rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-4 py-2.5 text-sm shadow-[var(--shadow-button)] focus:outline-none focus:ring-[length:var(--bw-default)]"
                />
              </div>
            )}

            {/* Type */}
            <div>
              <label className="font-body text-surface-700 mb-2 block text-sm font-semibold">
                Notification Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, type: opt.value })}
                    className={`font-body flex items-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] ${
                      form.type === opt.value
                        ? 'bg-surface-900 text-white shadow-[var(--shadow-button)]'
                        : 'text-surface-600 hover:bg-surface-50 bg-white'
                    }`}
                  >
                    {typeIconsMap[opt.value]}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="font-body text-surface-700 mb-2 block text-sm font-semibold">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
                placeholder="Notification title..."
                className="font-body focus:border-brand-500 focus:ring-brand-200 w-full rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-4 py-2.5 text-sm shadow-[var(--shadow-button)] focus:outline-none focus:ring-[length:var(--bw-default)]"
              />
            </div>

            {/* Body */}
            <div>
              <label className="font-body text-surface-700 mb-2 block text-sm font-semibold">
                Message
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                maxLength={2000}
                rows={4}
                placeholder="Notification message..."
                className="font-body focus:border-brand-500 focus:ring-brand-200 w-full resize-none rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-4 py-2.5 text-sm shadow-[var(--shadow-button)] focus:outline-none focus:ring-[length:var(--bw-default)]"
              />
              <p className="text-surface-400 mt-1 text-right font-mono text-xs">
                {form.body.length}/2000
              </p>
            </div>

            {/* Send Push Toggle */}
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.sendPush}
                  onChange={(e) => setForm({ ...form, sendPush: e.target.checked })}
                  className="text-brand-500 focus:ring-brand-300 h-5 w-5 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)]"
                />
                <span className="font-body text-surface-700 text-sm">
                  Send push notification via ntfy.sh
                </span>
              </label>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !form.title.trim() || !form.body.trim()}
              className="bg-brand-500 font-display hover:bg-brand-600 flex items-center justify-center gap-2 rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-card)] transition-all active:scale-[var(--active-press-scale)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : sendSuccess ? (
                <>
                  <Check className="h-4 w-4 text-success-500" />
                  Sent successfully!
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Notification
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="rounded-xl border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white shadow-[var(--shadow-card)]">
          {/* Filters */}
          <div className="border-surface-200 flex items-center gap-3 border-b-2 p-4">
            <Filter className="text-surface-400 h-4 w-4" />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as INotificationType | '');
                setPage(1);
              }}
              className="font-body text-surface-700 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-1.5 text-xs font-semibold"
            >
              <option value="">All Types</option>
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="text-surface-400 ml-auto font-mono text-xs">{total} notifications</div>
          </div>

          {/* List */}
          {loadingHistory ? (
            <div className="flex items-center justify-center p-12">
              <div className="border-surface-200 border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)]" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Bell className="text-surface-300 h-12 w-12" />
              <p className="font-body text-surface-500 mt-3 text-sm">No notifications sent yet</p>
              <p className="font-body text-surface-400 text-xs">
                Compose a notification to get started
              </p>
            </div>
          ) : (
            <div className="divide-surface-100 divide-y">
              {notifications.map((notif) => (
                <div key={notif.id} className="hover:bg-surface-50 flex items-start gap-4 p-4">
                  <span className="mt-0.5 flex-shrink-0">
                    {typeIconsMap[notif.type as INotificationType] ?? <Bell className="h-4 w-4 text-surface-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-body text-surface-900 text-sm font-bold">
                        {notif.title}
                      </h3>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
                          typeColors[notif.type] ?? 'bg-surface-100 text-surface-600'
                        }`}
                      >
                        {notif.type.replace(/_/g, ' ')}
                      </span>
                      <span className="bg-surface-100 text-surface-500 inline-block rounded-full px-2 py-0.5 font-mono text-[10px]">
                        {notif.targetType}
                      </span>
                    </div>
                    <p className="font-body text-surface-600 mt-1 text-sm">{notif.body}</p>
                    <div className="text-surface-400 mt-2 flex items-center gap-3 font-mono text-[11px]">
                      <span>{new Date(notif.sentAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>{notif.unreadBy.length} unread</span>
                      {notif.targetIds.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{notif.targetIds.length} target(s)</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-surface-200 flex items-center justify-center gap-2 border-t-2 p-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="font-body hover:bg-surface-100 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-1.5 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-surface-500 font-mono text-xs">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="font-body hover:bg-surface-100 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-1.5 text-xs font-semibold transition-all active:scale-[var(--active-press-scale)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
