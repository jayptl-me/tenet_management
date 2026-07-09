/**
 * Shared field / control class fragments.
 * All design systems (saas, brutalist, neumorphic, soft-ui) resolve via CSS variables.
 * Prefer these over ad-hoc Tailwind surface utilities so light/dark stay consistent.
 */

import { clsx } from 'clsx';

/** Base interactive control chrome (input, select, textarea). */
export const fieldControlBase = clsx(
  'w-full min-h-10 rounded-[var(--radius-md)] border bg-[color:var(--color-field-bg)]',
  'py-2 px-3.5 text-sm font-medium text-[color:var(--color-text-primary)]',
  'placeholder:text-[color:var(--color-text-muted)]',
  'shadow-[var(--shadow-xs)]',
  'transition-[background-color,border-color,box-shadow] duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
  'hover:bg-[color:var(--color-field-bg-hover)] hover:border-[color:var(--color-field-border-hover)]',
  'focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring-color)] focus:ring-offset-0',
  'focus:bg-[color:var(--color-card-bg)] focus:border-[color:var(--border-color-focus)] focus:shadow-none',
  'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] disabled:bg-[color:var(--disabled-bg)] disabled:shadow-none',
);

export const fieldControlBorderOk =
  'border-[color:var(--color-field-border)]';

export const fieldControlBorderError = clsx(
  'border-[color:var(--border-color-error)]',
  'focus:ring-[color:var(--color-danger-400)] focus:border-[color:var(--border-color-error)]',
);

export const fieldLabelClass =
  'text-[13px] font-semibold text-[color:var(--color-text-primary)]';

export const fieldHintClass =
  'text-[11px] font-medium text-[color:var(--color-text-muted)]';

export const fieldErrorClass =
  'text-[12px] font-medium text-[color:var(--color-danger-600)]';

export const fieldHelperClass =
  'text-[12px] font-medium text-[color:var(--color-text-muted)]';

/** Elevated card surface used by forms, tables, detail panels, dashboard panels. */
export const surfaceCardClass = clsx(
  'rounded-[var(--radius-xl)] border border-[color:var(--border-color)]',
  'bg-[color:var(--color-card-bg)] shadow-[var(--shadow-card)]',
);

/** Dashboard / list panel surface (alias for consistent SaaS panels). */
export const surfacePanelClass = surfaceCardClass;

/** Nested surface (e.g. section blocks inside a card). */
export const surfaceNestedClass = clsx(
  'rounded-[var(--radius-lg)] border border-[color:var(--border-color)]',
  'bg-[color:var(--color-field-bg)]',
);

/**
 * Section label inside multi-block forms.
 * Sentence-case product hierarchy (not tiny tracked uppercase eyebrows).
 */
export const formSectionTitleClass = clsx(
  'font-[family:var(--font-display)] text-sm font-bold tracking-tight',
  'text-[color:var(--color-text-primary)]',
);

/** Standard form action bar (footer). */
export const formActionsBarClass = clsx(
  'flex flex-col-reverse items-stretch justify-end gap-3',
  'border-t border-[color:var(--border-color)] pt-5',
  'sm:flex-row sm:items-center',
);

/** Page-level vertical rhythm for admin CRUD views. */
export const pageStackClass = 'space-y-6';
