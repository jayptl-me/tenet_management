'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Send,
  Users,
  Building2,
  DoorOpen,
  User,
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
import { parseApiError } from '@/lib/errorParser';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { ResourceSelect } from '@/components/ui/ResourceSelect';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TableActions } from '@/components/ui/TableActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';
import {
  floorLabel,
  roomLabel,
  roomSublabel,
  tenantLabel,
  tenantSublabel,
} from '@/lib/resource-select-presets';
import { useRouter } from 'next/navigation';
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

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [form, setForm] = useState<NotificationForm>(emptyForm);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [targetError, setTargetError] = useState('');
  const [pickerValue, setPickerValue] = useState('');

  // History state
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterType, setFilterType] = useState<INotificationType | ''>('');
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params: Record<string, string | number> = { page, limit: perPage };
      if (filterType) params.type = filterType;
      const res = await api.get('notifications', { searchParams: params }).json<{
        success: boolean;
        data: INotification[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>();
      setNotifications(res.data);
      setTotal(res.meta.total);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [page, perPage, filterType]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const addTargetId = (id: string) => {
    if (!id) return;
    setForm((prev) =>
      prev.targetIds.includes(id) ? prev : { ...prev, targetIds: [...prev.targetIds, id] },
    );
    setPickerValue('');
    setTargetError('');
  };

  const removeTargetId = (id: string) => {
    setForm((prev) => ({
      ...prev,
      targetIds: prev.targetIds.filter((t) => t !== id),
    }));
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (form.targetType !== 'all' && form.targetIds.length === 0) {
      setTargetError(
        form.targetType === 'floor'
          ? 'Select at least one floor'
          : form.targetType === 'room'
            ? 'Select at least one room'
            : 'Select at least one tenant',
      );
      toast.error('Select at least one target for this audience');
      return;
    }
    setTargetError('');
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
      setPickerValue('');
      toast.success('Notification sent');
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      const parsed = await parseApiError(err);
      toast.error(parsed.message);
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

  const historyColumns: DataTableColumn<INotification>[] = [
    {
      header: 'Title',
      accessor: (row) => (
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {row.title}
        </span>
      ),
    },
    {
      header: 'Type',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1.5">
          {typeIconsMap[row.type] ?? <Bell className="h-4 w-4" />}
          <span className="capitalize text-[color:var(--color-text-secondary)]">
            {row.type.replace(/_/g, ' ')}
          </span>
        </span>
      ),
    },
    {
      header: 'Target',
      accessor: (row) => (
        <span className="text-[color:var(--color-text-secondary)]">
          {targetLabels[row.targetType as TargetFilter] ?? row.targetType}
          {row.targetIds.length > 0 && (
            <span className="text-[color:var(--color-text-muted)]">
              {' '}({row.targetIds.length})
            </span>
          )}
        </span>
      ),
    },
    {
      header: 'Sent At',
      accessor: (row) => (
        <span className="text-[color:var(--color-text-secondary)]">
          {new Date(row.sentAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) =>
        row.unreadBy.length > 0 ? (
          <StatusBadge variant="warning" label={`${row.unreadBy.length} unread`} />
        ) : (
          <StatusBadge variant="success" label="All read" />
        ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <TableActions
          onView={() => router.push(`/notifications/${row.id}`)}
          onEdit={() => router.push(`/notifications/${row.id}/edit`)}
          showDelete={false}
        />
      ),
      className: 'w-[130px]',
    },
  ];

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
                    onClick={() => {
                      setForm({ ...form, targetType: key, targetIds: [] });
                      setPickerValue('');
                      setTargetError('');
                    }}
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

            {/* Target pickers (required when audience is not all) */}
            {form.targetType !== 'all' && (
              <div className="space-y-2">
                {form.targetType === 'floor' && (
                  <ResourceSelect
                    label="Add floor"
                    endpoint="floors"
                    value={pickerValue}
                    onChange={addTargetId}
                    placeholder="Select a floor to include..."
                    labelKey={floorLabel}
                    error={targetError}
                    helperText="Required: pick one or more floors. Recipients are tenants on those floors."
                  />
                )}
                {form.targetType === 'room' && (
                  <ResourceSelect
                    label="Add room"
                    endpoint="rooms?isActive=true"
                    value={pickerValue}
                    onChange={addTargetId}
                    placeholder="Select a room to include..."
                    labelKey={roomLabel}
                    sublabelFn={roomSublabel}
                    error={targetError}
                    helperText="Required: pick one or more rooms. Recipients are tenants in those rooms."
                  />
                )}
                {form.targetType === 'individual' && (
                  <ResourceSelect
                    label="Add tenant"
                    endpoint="tenants?isActive=true"
                    value={pickerValue}
                    onChange={addTargetId}
                    placeholder="Select a tenant to notify..."
                    valueKey="userId"
                    labelKey={(item) =>
                      tenantLabel(item as Parameters<typeof tenantLabel>[0])
                    }
                    sublabelFn={(item) =>
                      tenantSublabel(item as Parameters<typeof tenantSublabel>[0])
                    }
                    error={targetError}
                    helperText="Required: pick one or more tenants (uses their user account IDs)."
                  />
                )}
                {form.targetIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.targetIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removeTargetId(id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-danger-300)] hover:text-[color:var(--color-danger-600)]"
                        title="Remove"
                      >
                        <span className="max-w-[12rem] truncate font-[family:var(--font-mono)]">
                          {id}
                        </span>
                        <span aria-hidden="true">x</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setPickerValue('');
                  setTargetError('');
                }}
              >
                Clear
              </Button>
              <Button
                type="button"
                loading={sending}
                disabled={
                  !form.title.trim() ||
                  !form.body.trim() ||
                  (form.targetType !== 'all' && form.targetIds.length === 0)
                }
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
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as INotificationType | '');
                setPage(1);
              }}
              className="min-h-8 w-auto min-w-[10rem] py-1.5 text-xs font-semibold"
              options={[
                { value: '', label: 'All Types' },
                ...typeOptions.map((opt) => ({ value: opt.value, label: opt.label })),
              ]}
            />
            <span className="font-[family:var(--font-mono)] ml-auto text-xs text-[color:var(--color-text-muted)]">
              {total} notification{total !== 1 ? 's' : ''}
            </span>
          </div>

          <DataTable
            columns={historyColumns}
            data={notifications}
            keyExtractor={(row) => row.id}
            isLoading={loadingHistory}
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
                icon={<Bell className="h-12 w-12" />}
                title="No notifications sent yet"
                description="Compose a notification to get started"
              />
            }
            mobileCardRenderer={(row) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                    {row.title}
                  </span>
                  {row.unreadBy.length > 0 ? (
                    <StatusBadge variant="warning" label={`${row.unreadBy.length} unread`} />
                  ) : (
                    <StatusBadge variant="success" label="All read" />
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-[color:var(--color-text-secondary)]">
                  {row.body}
                </p>
                <div className="flex items-center gap-3 text-xs text-[color:var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1 capitalize">
                    {typeIconsMap[row.type] ?? <Bell className="h-3.5 w-3.5" />}
                    {row.type.replace(/_/g, ' ')}
                  </span>
                  <span>{targetLabels[row.targetType as TargetFilter] ?? row.targetType}</span>
                  <span>
                    {new Date(row.sentAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <TableActions
                    onView={() => router.push(`/notifications/${row.id}`)}
                    onEdit={() => router.push(`/notifications/${row.id}/edit`)}
                    showDelete={false}
                  />
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
