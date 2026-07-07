'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Calendar, Target, Info, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

interface NotificationDetail {
  _id: string;
  title: string;
  body: string;
  type: string;
  targetType: string;
  status: string;
  createdAt: string;
  scheduledFor?: string;
  metadata?: Record<string, unknown>;
}

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-[color:var(--color-brand-500)] h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="border-[color:var(--color-danger-500)] bg-[color:var(--color-danger-100)] text-[color:var(--color-danger-800)] rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Notification not found'}
        </div>
      </div>
    );
  }

  const formatType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h2 className="font-display text-[color:var(--color-surface-900)] text-2xl font-extrabold">
              {notification.title}
            </h2>
            <p className="text-[color:var(--color-surface-500)] text-sm">ID: {notification._id}</p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(notification.status)}
          label={notification.status.replace(/_/g, ' ')}
        />
      </div>

      {/* Type + Target Card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-[color:var(--color-surface-900)] mb-4 text-lg font-bold">
            <Bell className="mr-1 inline h-4 w-4" />
            Type
          </h3>
          <p className="text-[color:var(--color-surface-700)] text-sm font-semibold">
            {formatType(notification.type)}
          </p>
        </div>
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-[color:var(--color-surface-900)] mb-4 text-lg font-bold">
            <Target className="mr-1 inline h-4 w-4" />
            Target
          </h3>
          <p className="text-[color:var(--color-surface-700)] text-sm font-semibold capitalize">
            {notification.targetType}
          </p>
        </div>
      </div>

      {/* Body Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-[color:var(--color-surface-900)] mb-4 text-lg font-bold">
          <MessageCircle className="mr-1 inline h-4 w-4" />
          Message
        </h3>
        <p className="text-[color:var(--color-surface-700)] whitespace-pre-wrap text-sm leading-relaxed">
          {notification.body}
        </p>
      </div>

      {/* Meta Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-[color:var(--color-surface-900)] mb-4 text-lg font-bold">
          <Info className="mr-1 inline h-4 w-4" />
          Metadata
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[color:var(--color-surface-500)] text-xs font-semibold uppercase tracking-wider">
              Status
            </p>
            <p className="mt-1">
              <StatusBadge
                variant={statusToVariant(notification.status)}
                label={notification.status.replace(/_/g, ' ')}
              />
            </p>
          </div>
          <div>
            <p className="text-[color:var(--color-surface-500)] text-xs font-semibold uppercase tracking-wider">
              Created
            </p>
            <p className="text-[color:var(--color-surface-700)] mt-1 flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(notification.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          {notification.scheduledFor && (
            <div>
              <p className="text-[color:var(--color-surface-500)] text-xs font-semibold uppercase tracking-wider">
                Scheduled For
              </p>
              <p className="text-[color:var(--color-surface-700)] mt-1 flex items-center gap-1 text-sm">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(notification.scheduledFor).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
