'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeScaleIn } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

export interface FormCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function FormCard({
  title,
  description,
  children,
  className,
}: FormCardProps) {
  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={clsx(
        'mx-auto max-w-2xl rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {/* Header */}
      <div className="border-b border-[color:var(--border-color)] px-6 py-4">
        <h2 className="text-lg font-bold text-[color:var(--color-text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        {children}
      </div>
    </motion.div>
  );
}