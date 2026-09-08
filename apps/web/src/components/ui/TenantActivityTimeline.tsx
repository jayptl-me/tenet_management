'use client';

import { useState, useEffect } from 'react';
import {
  UserPlus,
  CreditCard,
  MessageSquare,
  CheckCircle2,
  Wrench,
  Megaphone,
  CalendarClock,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Timeline } from '@/components/ui/Timeline';

interface ActivityEvent {
  id: string;
  type:
    | 'move_in'
    | 'payment'
    | 'complaint_filed'
    | 'complaint_resolved'
    | 'service_update'
    | 'notice'
    | 'leave'
    | 'checkout'
    | 'payment_verified';
  title: string;
  subtitle?: string;
  amount?: number;
  date: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface TenantActivityTimelineProps {
  tenantId: string;
  compact?: boolean;
}

type TimelineStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const eventConfig: Record<string, { icon: React.ReactNode; status: TimelineStatus }> = {
  move_in: { icon: <UserPlus className="h-3.5 w-3.5" />, status: 'info' },
  payment: { icon: <CreditCard className="h-3.5 w-3.5" />, status: 'success' },
  payment_verified: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, status: 'success' },
  complaint_filed: { icon: <MessageSquare className="h-3.5 w-3.5" />, status: 'warning' },
  complaint_resolved: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, status: 'success' },
  service_update: { icon: <Wrench className="h-3.5 w-3.5" />, status: 'info' },
  notice: { icon: <Megaphone className="h-3.5 w-3.5" />, status: 'info' },
  leave: { icon: <CalendarClock className="h-3.5 w-3.5" />, status: 'info' },
  checkout: { icon: <LogOut className="h-3.5 w-3.5" />, status: 'danger' },
};

export function TenantActivityTimeline({ tenantId, compact = false }: TenantActivityTimelineProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    api
      .get(`tenants/${tenantId}/activity`)
      .json<{ success: boolean; data: ActivityEvent[] }>()
      .then((res) => {
        setEvents(res.data ?? []);
      })
      .catch(() => {
        setError('Failed to load activity');
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--color-surface-300)] border-t-[color:var(--color-brand-500)]" />
      </div>
    );
  }

  if (error || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertTriangle className="h-6 w-6 text-[color:var(--color-text-muted)]" />
        <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
          {error || 'No activity recorded yet'}
        </p>
      </div>
    );
  }

  const displayEvents = compact ? events.slice(0, 5) : events;

  return (
    <div>
      <Timeline
        events={displayEvents.map((event) => {
          const cfg = eventConfig[event.type] ?? {
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            status: 'neutral' as TimelineStatus,
          };
          const details = [
            event.subtitle,
            event.amount ? `Rs.${event.amount.toLocaleString()}` : undefined,
            event.status ? event.status.replace(/_/g, ' ') : undefined,
          ].filter(Boolean);
          return {
            id: event.id,
            date: event.date,
            title: event.title,
            description: details.length > 0 ? details.join(' - ') : undefined,
            status: cfg.status,
            icon: cfg.icon,
          };
        })}
      />

      {compact && events.length > 5 && (
        <p className="mt-2 pl-7 text-xs text-[color:var(--color-text-muted)]">
          {events.length - 5} more events
        </p>
      )}
    </div>
  );
}
