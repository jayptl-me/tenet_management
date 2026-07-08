'use client';

import { clsx } from 'clsx';

/**
 * Timeline -- vertical event timeline for service health history,
 * payment history, complaint resolution tracking, etc.
 * Theme-aware via var() tokens. Zero dependencies.
 */
export function Timeline({
  events,
  maxHeight,
  showIcons = true,
  className,
}: {
  events: Array<{
    id: string;
    date: Date | string;
    title: string;
    description?: string;
    status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    icon?: React.ReactNode;
  }>;
  maxHeight?: number;
  showIcons?: boolean;
  className?: string;
}) {
  const statusDot: Record<string, string> = {
    success: 'bg-[color:var(--color-success-500)]',
    warning: 'bg-[color:var(--color-warning-500)]',
    danger: 'bg-[color:var(--color-danger-500)]',
    info: 'bg-[color:var(--color-brand-500)]',
    neutral: 'bg-[color:var(--color-surface-300)]',
  };

  const formatDate = (d: Date | string): string => {
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(d);
    }
  };

  if (events.length === 0) {
    return (
      <div className={clsx('text-center py-8', className)}>
        <p className="text-[13px] font-medium text-[color:var(--color-text-muted)]">
          No events recorded
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx('relative', className)}
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
    >
      {/* Vertical line */}
      <div className="absolute left-[11px] top-1 bottom-1 w-0.5 rounded-full bg-[color:var(--color-surface-200)]" />

      <div className="space-y-4">
        {events.map((event, idx) => {
          const dotColor = statusDot[event.status ?? 'neutral'] ?? statusDot.neutral;
          const isLast = idx === events.length - 1;

          return (
            <div key={event.id} className="relative flex gap-4 pl-7">
              {/* Dot on the timeline */}
              <span
                className={clsx(
                  'absolute left-[7px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--color-surface-100)] flex-shrink-0 z-10',
                  dotColor,
                )}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-[11px] font-semibold text-[color:var(--color-text-muted)]">
                    {formatDate(event.date)}
                  </p>
                  <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                    {event.title}
                  </p>
                  {showIcons && event.icon && (
                    <span className="text-[color:var(--color-text-muted)]">{event.icon}</span>
                  )}
                </div>
                {event.description && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[color:var(--color-text-muted)]">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Timeline;
