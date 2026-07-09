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

interface ActivityEvent {
  id: string;
  type: 'move_in' | 'payment' | 'complaint_filed' | 'complaint_resolved' | 'service_update' | 'notice' | 'leave' | 'checkout' | 'payment_verified';
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

const eventConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  move_in: {
    icon: <UserPlus className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-brand-600)]',
    bg: 'bg-[color:var(--color-brand-100)]',
  },
  payment: {
    icon: <CreditCard className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-success-600)]',
    bg: 'bg-[color:var(--color-success-100)]',
  },
  payment_verified: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-success-600)]',
    bg: 'bg-[color:var(--color-success-100)]',
  },
  complaint_filed: {
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-warning-600)]',
    bg: 'bg-[color:var(--color-warning-100)]',
  },
  complaint_resolved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-success-600)]',
    bg: 'bg-[color:var(--color-success-100)]',
  },
  service_update: {
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-brand-600)]',
    bg: 'bg-[color:var(--color-brand-100)]',
  },
  notice: {
    icon: <Megaphone className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-brand-600)]',
    bg: 'bg-[color:var(--color-brand-100)]',
  },
  leave: {
    icon: <CalendarClock className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-brand-600)]',
    bg: 'bg-[color:var(--color-brand-100)]',
  },
  checkout: {
    icon: <LogOut className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-danger-600)]',
    bg: 'bg-[color:var(--color-danger-100)]',
  },
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
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-px bg-[color:var(--border-color)]" />

      <div className="space-y-0">
        {displayEvents.map((event) => {
          const cfg = eventConfig[event.type] ?? {
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            color: 'text-[color:var(--color-text-secondary)]',
            bg: 'bg-[color:var(--color-field-bg)]',
          };

          return (
            <div key={event.id} className="relative flex gap-3 pb-4">
              {/* Dot + icon */}
              <div className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg} ${cfg.color}`}>
                {cfg.icon}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight text-[color:var(--color-text-primary)]">
                    {event.title}
                  </p>
                  <span className="flex-shrink-0 text-[10px] text-[color:var(--color-text-muted)]">
                    {new Date(event.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
                {event.subtitle && (
                  <p className="text-xs leading-tight text-[color:var(--color-text-muted)]">{event.subtitle}</p>
                )}
                {event.amount ? (
                  <p className="mt-0.5 text-xs font-bold text-[color:var(--color-text-primary)]">
                    ₹{event.amount.toLocaleString()}
                  </p>
                ) : null}
                {event.status && (
                  <span className="mt-0.5 inline-block text-[10px] capitalize text-[color:var(--color-text-muted)]">
                    {event.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {compact && events.length > 5 && (
          <div className="relative flex gap-3 pb-2">
            <div className="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-field-bg)]">
              <span className="font-mono text-[9px] font-bold text-[color:var(--color-text-muted)]">+{events.length - 5}</span>
            </div>
            <p className="self-center text-xs text-[color:var(--color-text-muted)]">
              {events.length - 5} more events
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
