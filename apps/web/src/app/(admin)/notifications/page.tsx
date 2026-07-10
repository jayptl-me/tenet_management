'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
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
  Copy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from 'sonner';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';
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
  emergency: <AlertTriangle className="h-4 w-4 text-[color:var(--color-danger-500)]" />,
  payment_reminder: <CreditCard className="h-4 w-4 text-[color:var(--color-warning-500)]" />,
  payment_verified: <Check className="h-4 w-4 text-[color:var(--color-success-500)]" />,
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
  emergency: 'bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)]',
  payment_verified: 'bg-[color:var(--color-success-100)] text-[color:var(--color-success-800)]',
  payment_reminder: 'bg-[color:var(--color-warning-100)] text-[color:var(--color-warning-800)]',
  welcome: 'bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-800)]',
};

export default function NotificationsPage() {
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Broadcast announcements and manage notification history"
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-1 shadow-[var(--shadow-xs)]">
        <button
          onClick={() => setActiveTab('compose')}
          className={`font-[family:var(--font-display)] flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-[var(--transition-duration)] ${
            activeTab === 'compose'
              ? 'bg-[color:var(--color-card-bg)] text-[color:var(--color-text-primary)] shadow-[var(--shadow-button)]'
              : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]'
          }`}
        >
          <Send className="mr-2 inline-block h-4 w-4" />
          Compose
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`font-[family:var(--font-display)] flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-[var(--transition-duration)] ${
            activeTab === 'history'
              ? 'bg-[color:var(--color-card-bg)] text-[color:var(--color-text-primary)] shadow-[var(--shadow-button)]'
              : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]'
          }`}
        >
          <Bell className="mr-2 inline-block h-4 w-4" />
          History
        </button>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] p-6 shadow-[var(--shadow-card)]">
          <div className="grid gap-5">
            {/* Target Type */}
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                Target Audience
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(targetLabels) as TargetFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, targetType: key, targetIds: [] })}
                    className={`flex items-center justify-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all duration-[var(--transition-duration)] active:scale-[var(--active-press-scale)] ${
                      form.targetType === key
                        ? 'bg-[color:var(--color-brand-500)] text-white shadow-[var(--shadow-button)]'
                        : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
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
              <Input
                label={
                  form.targetType === 'floor'
                    ? 'Floor IDs'
                    : form.targetType === 'room'
                      ? 'Room IDs'
                      : 'User IDs'
                }
                hint="comma-separated"
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
              />
            )}

            {/* Type */}
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                Notification Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: opt.value })}
                    className={`flex items-center gap-2 rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-2 text-xs font-semibold transition-all duration-[var(--transition-duration)] active:scale-[var(--active-press-scale)] ${
                      form.type === opt.value
                        ? 'bg-[color:var(--color-text-primary)] text-[color:var(--color-card-bg)] shadow-[var(--shadow-button)]'
                        : 'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-100)]'
                    }`}
                  >
                    {typeIconsMap[opt.value]}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
              placeholder="Notification title..."
            />

            {/* Body */}
            <Textarea
              label="Message"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              maxLength={2000}
              rows={4}
              hint={`${form.body.length}/2000`}
              placeholder="Notification message..."
            />

            {/* WhatsApp Share Preview for Emergency */}
            {form.type === 'emergency' &&
              (() => {
                const whatsappUrl = generateWhatsAppUrl(
                  '',
                  `EMERGENCY: ${form.title}\n${form.body}`,
                );
                return (
                  <div className="mt-1 rounded-lg border-[length:var(--bw-default)] border-[color:var(--color-warning-500)] bg-[color:var(--color-warning-50)] p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-primary)]">
                      WhatsApp Share Preview
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-[family:var(--font-mono)] flex-1 truncate text-xs text-[color:var(--color-brand-600)] underline"
                      >
                        {whatsappUrl}
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          copyToClipboard(whatsappUrl);
                          toast.success('WhatsApp link copied to clipboard');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy link
                      </Button>
                    </div>
                  </div>
                );
              })()}

            {/* Send Push Toggle */}
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.sendPush}
                  onChange={(e) => setForm({ ...form, sendPush: e.target.checked })}
                  className="h-5 w-5 rounded border-[length:var(--bw-default)] border-[color:var(--border-color)] text-[color:var(--color-brand-500)] focus:ring-[color:var(--color-brand-300)]"
                />
                <span className="text-sm text-[color:var(--color-text-primary)]">
                  Send push notification via ntfy.sh
                </span>
              </label>
            </div>

            {/* Send Button */}
            <div className="flex items-center justify-end gap-3 border-t-[length:var(--bw-strong)] border-t-[color:var(--color-surface-200)] pt-5">
              <Button variant="outline" type="button" onClick={() => setForm(emptyForm)}>
                Clear
              </Button>
              <Button
                type="button"
                loading={sending}
                disabled={!form.title.trim() || !form.body.trim()}
                onClick={handleSend}
              >
                <Send className="h-4 w-4" />
                {sendSuccess ? 'Sent Successfully!' : 'Send Notification'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] shadow-[var(--shadow-card)]">
          {/* Filters */}
          <div className="flex items-center gap-3 border-b-[length:var(--bw-strong)] border-b-[color:var(--color-surface-200)] p-4">
            <Filter className="h-4 w-4 text-[color:var(--color-text-muted)]" />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as INotificationType | '');
                setPage(1);
              }}
              className="rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text-primary)]"
            >
              <option value="">All Types</option>
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="font-[family:var(--font-mono)] ml-auto text-xs text-[color:var(--color-text-muted)]">
              {total} notifications
            </div>
          </div>

          {/* List */}
          {loadingHistory ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--color-surface-200)] border-t-[color:var(--color-brand-500)]" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Bell className="h-12 w-12 text-[color:var(--color-text-muted)]" />
              <p className="mt-3 text-sm text-[color:var(--color-text-muted)]">
                No notifications sent yet
              </p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Compose a notification to get started
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--color-surface-200)]">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-start gap-4 p-4 transition-colors duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-50)]"
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {typeIconsMap[notif.type as INotificationType] ?? (
                      <Bell className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[color:var(--color-text-primary)]">
                        {notif.title}
                      </h3>
                      <span
                        className={`font-[family:var(--font-mono)] inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          typeColors[notif.type] ??
                          'bg-[color:var(--color-surface-200)] text-[color:var(--color-text-secondary)]'
                        }`}
                      >
                        {notif.type.replace(/_/g, ' ')}
                      </span>
                      <span className="font-[family:var(--font-mono)] inline-block rounded-full bg-[color:var(--color-surface-100)] px-2 py-0.5 text-[10px] text-[color:var(--color-text-muted)]">
                        {notif.targetType}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                      {notif.body}
                    </p>
                    <div className="font-[family:var(--font-mono)] mt-2 flex items-center gap-3 text-[11px] text-[color:var(--color-text-muted)]">
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
            <div className="flex items-center justify-center gap-2 border-t-[length:var(--bw-strong)] border-t-[color:var(--color-surface-200)] p-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-1.5 text-xs font-semibold transition-all duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)] active:scale-[var(--active-press-scale)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Previous
              </button>
              <span className="font-[family:var(--font-mono)] text-xs text-[color:var(--color-text-muted)]">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-1.5 text-xs font-semibold transition-all duration-[var(--transition-duration)] hover:bg-[color:var(--color-surface-100)] active:scale-[var(--active-press-scale)] disabled:cursor-not-allowed disabled:opacity-30"
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
