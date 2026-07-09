'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeScaleIn } from '@/lib/animations';
import { surfaceCardClass } from '@/lib/field-styles';

// ── Types ──────────────────────────────────────────────

export interface FormCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Footer slot (typically FormActions). Rendered below a divider. */
  footer?: React.ReactNode;
  className?: string;
  /** When provided, renders as <form>. */
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  /** Optional id for the form element. */
  id?: string;
  /** Disable default max-width (parent FormPage already constrains). */
  fullWidth?: boolean;
}

// ── Component ──────────────────────────────────────────

/**
 * Elevated form container with optional header and sticky-style footer.
 * Uses CSS variable surfaces so all theme presets render correctly.
 */
export function FormCard({
  title,
  description,
  children,
  footer,
  className,
  onSubmit,
  id,
  fullWidth = true,
}: FormCardProps) {
  const body = (
    <>
      {(title || description) && (
        <div className="border-b border-[color:var(--border-color)] bg-[color:var(--color-card-bg)] px-5 py-4 sm:px-6">
          {title && (
            <h2 className="font-[family:var(--font-display)] text-base font-bold tracking-tight text-[color:var(--color-text-primary)] sm:text-lg">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>

      {footer && (
        <div className="sticky bottom-0 border-t border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]/90 px-5 py-4 backdrop-blur-sm sm:px-6">
          {footer}
        </div>
      )}
    </>
  );

  const classes = clsx(
    surfaceCardClass,
    'overflow-hidden',
    !fullWidth && 'mx-auto max-w-2xl',
    className,
  );

  if (onSubmit) {
    return (
      <motion.form
        id={id}
        variants={fadeScaleIn}
        initial="hidden"
        animate="visible"
        onSubmit={onSubmit}
        className={classes}
        noValidate
      >
        {body}
      </motion.form>
    );
  }

  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={classes}
    >
      {body}
    </motion.div>
  );
}
