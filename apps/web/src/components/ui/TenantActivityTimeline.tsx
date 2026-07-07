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
    color: 'text-brand-600',
    bg: 'bg-brand-100',
  },
  payment: {
    icon: <CreditCard className="h-3.5 w-3.5" />,
    color: 'text-success-600',
    bg: 'bg-success-100',
  },
  payment_verified: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-success-600',
    bg: 'bg-success-100',
  },
  complaint_filed: {
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    color: 'text-warning-600',
    bg: 'bg-warning-100',
  },
  complaint_resolved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-success-600',
    bg: 'bg-success-100',
  },
  service_update: {
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: 'text-brand-600',
    bg: 'bg-brand-100',
  },
  notice: {
    icon: <Megaphone className="h-3.5 w-3.5" />,
    color: 'text-[color:var(--color-brand-600)]',
    bg: 'bg-[color:var(--color-brand-100)]',
  },
  leave: {
    icon: <CalendarClock className="h-3.5 w-3.5" />,
    color: 'text-brand-600',
    bg: 'bg-brand-100',
  },
  checkout: {
    icon: <LogOut className="h-3.5 w-3.5" />,
    color: 'text-danger-600',
    bg: 'bg-danger-100',
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
        <div className="border-surface-300 border-t-brand-500 h-5 w-5 animate-spin rounded-full border-2" />
      </div>
    );
  }

  if (error || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertTriangle className="text-surface-300 h-6 w-6" />
        <p className="text-surface-400 mt-2 text-xs">
          {error || 'No activity recorded yet'}
        </p>
      </div>
    );
  }

  const displayEvents = compact ? events.slice(0, 5) : events;

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="bg-surface-200 absolute left-[11px] top-2 h-[calc(100%-16px)] w-px" />

      <div className="space-y-0">
        {displayEvents.map((event, idx) => {
          const cfg = eventConfig[event.type] ?? {
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            color: 'text-surface-600',
            bg: 'bg-surface-100',
          };
          const isLast = idx === displayEvents.length - 1;

          return (
            <div key={event.id} className="relative flex gap-3 pb-4">
              {/* Dot + icon */}
              <div className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg} ${cfg.color}`}>
                {cfg.icon}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-surface-900 text-sm font-semibold leading-tight">
                    {event.title}
                  </p>
                  <span className="text-surface-400 flex-shrink-0 text-[10px]">
                    {new Date(event.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
                {event.subtitle && (
                  <p className="text-surface-500 text-xs leading-tight">{event.subtitle}</p>
                )}
                {event.amount ? (
                  <p className="text-surface-900 mt-0.5 text-xs font-bold">
                    ₹{event.amount.toLocaleString()}
                  </p>
                ) : null}
                {event.status && (
                  <span className="text-surface-400 mt-0.5 inline-block text-[10px] capitalize">
                    {event.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {compact && events.length > 5 && (
          <div className="relative flex gap-3 pb-2">
            <div className="bg-surface-100 relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full">
              <span className="text-surface-500 text-[9px] font-bold font-mono">+{events.length - 5}</span>
            </div>
            <p className="text-surface-400 self-center text-xs">
              {events.length - 5} more events
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
