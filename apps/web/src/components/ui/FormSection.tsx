'use client';

import { clsx } from 'clsx';

export interface FormSectionProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Show top divider (default true when not first — pass explicitly). */
  divided?: boolean;
  /** Optional trailing header control (badge, switch, etc.). */
  action?: React.ReactNode;
}

/**
 * Logical grouping block inside a multi-section form card.
 * Product hierarchy: sentence-case section title (not tracked uppercase eyebrows).
 * Token-only surfaces for light/dark SaaS.
 */
export function FormSection({
  title,
  description,
  icon,
  children,
  className,
  divided = false,
  action,
}: FormSectionProps) {
  return (
    <section
      className={clsx(
        'space-y-4',
        divided && 'mt-6 border-t border-[color:var(--border-color)] pt-6 sm:mt-8 sm:pt-8',
        className,
      )}
    >
      {(title || description || action) && (
        <header className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-1">
            {title && (
              <h3 className="flex items-center gap-2 font-[family:var(--font-display)] text-sm font-bold tracking-tight text-[color:var(--color-text-primary)] sm:text-[15px]">
                {icon && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-field-bg)] text-[color:var(--color-text-secondary)] [&_svg]:h-3.5 [&_svg]:w-3.5">
                    {icon}
                  </span>
                )}
                <span className="text-balance">{title}</span>
              </h3>
            )}
            {description && (
              <p className="max-w-prose text-xs leading-relaxed text-[color:var(--color-text-secondary)] sm:text-[13px]">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 pt-0.5">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export interface FormGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}

/**
 * Responsive field grid.
 * Mobile: always 1 col. sm+: 2. lg+: optional 3.
 * Gap uses spacing scale; full-width children with col-span helpers welcome.
 */
export function FormGrid({ children, cols = 2, className }: FormGridProps) {
  const colClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 3
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className={clsx('grid gap-4 sm:gap-x-5 sm:gap-y-4', colClass, className)}>
      {children}
    </div>
  );
}

/** Span full row inside FormGrid (e.g. notes, description). */
export function FormFullWidth({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx('col-span-full', className)}>{children}</div>;
}
