'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bell,
  Calendar,
  Target,
  Info,
  MessageCircle,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  Clock,
  Share2,
  Copy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';
import type { INotification } from '@pg/types';

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function NotificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [notification, setNotification] = useState<INotification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`notifications/${id}`).json();
      toast.success('Notification deleted successfully');
      router.push('/notifications?tab=history');
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`notifications/${id}`)
      .json<{ success: boolean; data: INotification }>()
      .then((res) => {
        setNotification(res.data);
      })
      .catch(() => {
        setError('Failed to load notification');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (!isLoading && (error || !notification)) {
    return (
      <FormPage
        title="Notification Details"
        description="View notification information"
        backHref="/notifications?tab=history"
        error={error || 'Notification not found'}
        maxWidth="4xl"
      />
    );
  }

  const formatType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const notifId = notification?.id || (notification as unknown as { _id?: string })?._id || id;
  const recipientCount = notification?.recipientUserIds?.length ?? 0;
  const unreadCount = notification?.unreadBy?.length ?? 0;
  const readCount = Math.max(0, recipientCount - unreadCount);
  const readPercent = recipientCount > 0 ? Math.round((readCount / recipientCount) * 100) : 100;

  return (
    <FormPage
      title={notification?.title ?? 'Notification Details'}
      description={notification ? `Broadcast ID: ${notifId}` : undefined}
      backHref="/notifications?tab=history"
      isLoading={isLoading}
      maxWidth="4xl"
      actions={
        notification ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/notifications/${notifId}/edit`)}>
              <Pencil className="h-4 w-4" />
              Edit Notification
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        ) : undefined
      }
      badge={
        notification ? (
          <StatusBadge
            variant={unreadCount > 0 ? 'warning' : 'success'}
            label={unreadCount > 0 ? `${unreadCount} Unread` : 'All Read'}
          />
        ) : undefined
      }
    >
      {notification && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DetailCard title="Category & Type" icon={<Bell />}>
              <div className="space-y-1">
                <p className="text-base font-bold text-[color:var(--color-text-primary)]">
                  {formatType(notification.type)}
                </p>
                <p className="text-xs text-[color:var(--color-text-muted)]">
                  Sent on {formatDateTime(notification.sentAt || notification.createdAt)}
                </p>
              </div>
            </DetailCard>

            <DetailCard title="Target Audience" icon={<Target />}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[color:var(--color-text-primary)] capitalize">
                    {notification.targetType === 'all'
                      ? 'All Active Tenants'
                      : `By ${notification.targetType}`}
                  </span>
                  {notification.targetIds?.length > 0 && (
                    <span className="rounded-full bg-[color:var(--color-surface-100)] px-2 py-0.5 font-mono text-xs font-medium text-[color:var(--color-text-secondary)]">
                      {notification.targetIds.length} target
                      {notification.targetIds.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {notification.targetIds?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {notification.targetIds.map((tid) => (
                      <span
                        key={tid}
                        className="rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--color-text-secondary)]"
                      >
                        {tid}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </DetailCard>
          </div>

          <DetailCard title="Delivery & Read Breakdown" icon={<Users />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-text-muted)]">
                  <Users className="h-3.5 w-3.5" />
                  Total Recipients
                </div>
                <p className="mt-1 text-2xl font-extrabold text-[color:var(--color-text-primary)]">
                  {recipientCount}
                </p>
                <p className="text-[11px] text-[color:var(--color-text-muted)]">
                  Active tenants matched at broadcast
                </p>
              </div>

              <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-success-600)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Read Receipts
                </div>
                <p className="mt-1 text-2xl font-extrabold text-[color:var(--color-success-600)]">
                  {readCount}
                </p>
                <p className="text-[11px] text-[color:var(--color-text-muted)]">
                  {readPercent}% completion rate
                </p>
              </div>

              <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-warning-600)]">
                  <Clock className="h-3.5 w-3.5" />
                  Pending Read
                </div>
                <p className="mt-1 text-2xl font-extrabold text-[color:var(--color-warning-600)]">
                  {unreadCount}
                </p>
                <p className="text-[11px] text-[color:var(--color-text-muted)]">
                  Tenants yet to acknowledge
                </p>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="Notification Message" icon={<MessageCircle />}>
            <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] p-4">
              <h4 className="text-base font-bold text-[color:var(--color-text-primary)]">
                {notification.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
                {notification.body}
              </p>
            </div>
          </DetailCard>

          {/* WhatsApp share for emergency alerts */}
          {notification.type === 'emergency' && (
            <div className="rounded-xl border border-[color:var(--color-warning-500)] bg-[color:var(--color-warning-50)] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text-primary)]">
                    <Share2 className="h-4 w-4 text-[color:var(--color-warning-600)]" />
                    WhatsApp Broadcast Share
                  </h4>
                  <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
                    Share this emergency alert via WhatsApp Web or Mobile
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const url = generateWhatsAppUrl(
                      '',
                      `[EMERGENCY] ${notification.title}\n\n${notification.body}`,
                    );
                    copyToClipboard(url);
                    toast.success('WhatsApp link copied to clipboard');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy WhatsApp Link
                </Button>
              </div>
            </div>
          )}

          <DetailCard title="System Information" icon={<Info />}>
            <DetailList>
              <DetailRow
                label="Sent At"
                value={
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(notification.sentAt || notification.createdAt)}
                  </span>
                }
              />
              <DetailRow
                label="Target Scope"
                value={<span className="font-semibold capitalize">{notification.targetType}</span>}
              />
              <DetailRow
                label="Read Status"
                value={
                  <StatusBadge
                    variant={unreadCount > 0 ? 'warning' : 'success'}
                    label={
                      unreadCount > 0 ? `${unreadCount} unacknowledged` : 'Acknowledged by all'
                    }
                  />
                }
              />
            </DetailList>
          </DetailCard>
        </div>
      )}

      {notification && (
        <ConfirmModal
          open={showDeleteModal}
          title="Delete Notification"
          message={`Are you sure you want to delete "${notification.title}"? This will remove the notification from all tenant inboxes.`}
          confirmLabel="Delete"
          variant="danger"
          loading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </FormPage>
  );
}
