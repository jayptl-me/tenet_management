'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Bell, Calendar, Target, Info, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

interface NotificationDetail {
  _id: string;
  title: string;
  body: string;
  type: string;
  targetType: string;
  /** Not always on model — derive from sentAt when missing */
  status?: string;
  createdAt: string;
  sentAt?: string;
  scheduledFor?: string;
  metadata?: Record<string, unknown>;
}

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
  const params = useParams();
  const id = params.id as string;

  const [notification, setNotification] = useState<NotificationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`notifications/${id}`)
      .json<{ success: boolean; data: NotificationDetail }>()
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
        backHref="/notifications"
        error={error || 'Notification not found'}
        maxWidth="4xl"
      />
    );
  }

  const formatType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const displayStatus =
    notification?.status ||
    (notification?.sentAt ? 'sent' : 'recorded');

  return (
    <FormPage
      title={notification?.title ?? 'Notification Details'}
      description={notification ? `ID: ${notification._id}` : undefined}
      backHref="/notifications"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        notification ? (
          <StatusBadge
            variant={statusToVariant(displayStatus)}
            label={displayStatus.replace(/_/g, ' ')}
          />
        ) : undefined
      }
    >
      {notification && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DetailCard title="Type" icon={<Bell />}>
              <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {formatType(notification.type)}
              </p>
            </DetailCard>
            <DetailCard title="Target" icon={<Target />}>
              <p className="text-sm font-semibold capitalize text-[color:var(--color-text-primary)]">
                {notification.targetType}
              </p>
            </DetailCard>
          </div>

          <DetailCard title="Message" icon={<MessageCircle />}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
              {notification.body}
            </p>
          </DetailCard>

          <DetailCard title="Metadata" icon={<Info />}>
            <DetailList>
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    variant={statusToVariant(displayStatus)}
                    label={displayStatus.replace(/_/g, ' ')}
                  />
                }
              />
              <DetailRow
                label="Created"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDateTime(notification.createdAt)}
                  </span>
                }
              />
              {notification.scheduledFor && (
                <DetailRow
                  label="Scheduled For"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {formatDateTime(notification.scheduledFor)}
                    </span>
                  }
                />
              )}
            </DetailList>
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
