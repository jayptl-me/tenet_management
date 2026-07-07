'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white border-[length:var(--bw-strong)] border-[color:var(--border-color)] hover:bg-brand-600 active:scale-[var(--active-press-scale)] active:translate-x-[var(--active-press-x)] active:translate-y-[var(--active-press-y)] active:shadow-[var(--shadow-button-pressed)] shadow-[var(--shadow-button)]',
  secondary:
    'bg-[color:var(--color-surface-100)] text-surface-900 border-[length:var(--bw-strong)] border-[color:var(--border-color)] hover:bg-surface-100 active:scale-[var(--active-press-scale)] active:translate-x-[var(--active-press-x)] active:translate-y-[var(--active-press-y)] active:shadow-[var(--shadow-button-pressed)] shadow-[var(--shadow-button)]',
  danger:
    'bg-danger-500 text-white border-[length:var(--bw-strong)] border-[color:var(--border-color)] hover:bg-danger-600 active:scale-[var(--active-press-scale)] active:translate-x-[var(--active-press-x)] active:translate-y-[var(--active-press-y)] active:shadow-[var(--shadow-button-pressed)] shadow-[var(--shadow-button)]',
  ghost:
    'bg-transparent text-surface-700 border-[length:var(--bw-strong)] border-transparent hover:bg-surface-100 hover:text-surface-900',
  outline:
    'bg-transparent text-surface-900 border-[length:var(--bw-strong)] border-[color:var(--border-color)] hover:bg-surface-100 active:scale-[var(--active-press-scale)] active:translate-x-[var(--active-press-x)] active:translate-y-[var(--active-press-y)] active:shadow-[var(--shadow-button-pressed)] shadow-[var(--shadow-button)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm font-semibold rounded-[var(--radius-md)]',
  md: 'px-5 py-2.5 text-base font-semibold rounded-[var(--radius-md)]',
  lg: 'px-7 py-3 text-lg font-bold rounded-[var(--radius-lg)]',
  icon: 'p-2 rounded-[var(--radius-md)] aspect-square flex items-center justify-center',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, className, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'font-display hover:translate-[var(--hover-lift)] inline-flex items-center justify-center gap-2 transition-all duration-[var(--transition-duration)] ease-[var(--transition-easing)] focus-visible:outline-none focus-visible:ring-[length:var(--bw-strong)] focus-visible:ring-[color:var(--border-color)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
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
  },
);

Button.displayName = 'Button';
