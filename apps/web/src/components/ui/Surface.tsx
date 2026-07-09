'use client';

import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeScaleIn } from '@/lib/animations';
import { surfaceCardClass, surfaceNestedClass } from '@/lib/field-styles';

export type SurfaceVariant = 'card' | 'nested' | 'ghost' | 'glass';

export interface SurfaceProps {
  children: React.ReactNode;
  variant?: SurfaceVariant;
  className?: string;
  as?: 'div' | 'section' | 'article';
  animate?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles: Record<SurfaceVariant, string> = {
  card: surfaceCardClass,
  nested: surfaceNestedClass,
  ghost: 'rounded-[var(--radius-xl)] bg-transparent',
  glass: clsx(
    'rounded-[var(--radius-xl)] border border-[color:var(--glass-border)]',
    'bg-[color:var(--glass-bg)] shadow-[var(--shadow-card)]',
    'backdrop-blur-[var(--glass-blur)]',
  ),
};

const paddingStyles: Record<NonNullable<SurfaceProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function Surface({
  children,
  variant = 'card',
  className,
  as: Tag = 'div',
  animate = false,
  padding = 'none',
}: SurfaceProps) {
  const classes = clsx(variantStyles[variant], paddingStyles[padding], className);

  if (animate) {
    return (
      <motion.div
        variants={fadeScaleIn}
        initial="hidden"
        animate="visible"
        className={classes}
      >
        {children}
      </motion.div>
    );
  }

  return <Tag className={classes}>{children}</Tag>;
}
