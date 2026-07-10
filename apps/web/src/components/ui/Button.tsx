'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { transitionTween } from '@/lib/animations';

// ── Types ──────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  animate?: boolean;
  children: React.ReactNode;
}

// ── Style Maps ─────────────────────────────────────────

const focusRing =
  'focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--focus-ring-offset-bg)]';

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-[color:var(--color-brand-500)] text-[color:var(--color-text-inverted)]',
    'border border-[color:var(--color-brand-600)]',
    'shadow-[var(--shadow-button)]',
    'hover:bg-[color:var(--color-brand-600)] hover:shadow-[var(--shadow-md)]',
    'active:bg-[color:var(--color-brand-700)] active:scale-[0.98]',
    focusRing,
  ].join(' '),
  secondary: [
    'bg-[color:var(--color-field-bg)] text-[color:var(--color-text-primary)]',
    'border border-[color:var(--border-color)]',
    'shadow-[var(--shadow-xs)]',
    'hover:bg-[color:var(--color-field-bg-hover)] hover:border-[color:var(--color-field-border-hover)] hover:shadow-[var(--shadow-sm)]',
    'active:bg-[color:var(--color-surface-200)] active:scale-[0.98]',
    focusRing,
  ].join(' '),
  danger: [
    'bg-[color:var(--color-danger-500)] text-[color:var(--color-text-inverted)]',
    'border border-[color:var(--color-danger-600)]',
    'shadow-[var(--shadow-button)]',
    'hover:bg-[color:var(--color-danger-600)] hover:shadow-[var(--shadow-md)]',
    'active:bg-[color:var(--color-danger-700)] active:scale-[0.98]',
    'focus-visible:ring-2 focus-visible:ring-[color:var(--color-danger-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--focus-ring-offset-bg)]',
  ].join(' '),
  ghost: [
    'bg-transparent text-[color:var(--color-text-secondary)]',
    'border border-transparent',
    'hover:bg-[color:var(--color-field-bg-hover)] hover:text-[color:var(--color-text-primary)]',
    'active:bg-[color:var(--color-surface-200)] active:scale-[0.98]',
    focusRing,
  ].join(' '),
  outline: [
    'bg-[color:var(--color-card-bg)] text-[color:var(--color-text-primary)]',
    'border border-[color:var(--border-color)]',
    'hover:bg-[color:var(--color-field-bg)] hover:border-[color:var(--color-brand-400)]',
    'active:bg-[color:var(--color-field-bg-hover)] active:scale-[0.98]',
    focusRing,
  ].join(' '),
  glass: [
    'bg-[color:var(--glass-bg)] text-[color:var(--color-text-primary)]',
    'border border-[color:var(--glass-border)]',
    'backdrop-blur-[var(--glass-blur)]',
    'shadow-[var(--shadow-sm)]',
    'hover:bg-[color:var(--glass-bg-strong)] hover:shadow-[var(--shadow-md)]',
    'active:scale-[0.98]',
    focusRing,
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-[13px] font-semibold rounded-[var(--radius-md)] gap-1.5',
  md: 'min-h-10 px-4 py-2 text-sm font-semibold rounded-[var(--radius-md)] gap-2',
  lg: 'min-h-11 px-6 py-2.5 text-[15px] font-bold rounded-[var(--radius-lg)] gap-2',
  icon: 'h-10 w-10 min-h-10 min-w-10 p-0 rounded-[var(--radius-md)] flex items-center justify-center',
};

// ── Component ──────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      animate = true,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    if (!animate) {
      return (
        <button
          ref={ref}
          disabled={isDisabled}
          className={clsx(
            'inline-flex items-center justify-center font-medium tracking-tight transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
            'focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]',
            variantStyles[variant],
            sizeStyles[size],
            className,
          )}
          {...props}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {children}
        </button>
      );
    }

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        whileHover={isDisabled ? undefined : { y: -1 }}
        whileTap={isDisabled ? undefined : { scale: 0.98, y: 0 }}
        transition={transitionTween}
        className={clsx(
          'inline-flex items-center justify-center font-medium tracking-tight transition-colors duration-[var(--transition-duration)] ease-[var(--transition-easing)]',
          'focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
