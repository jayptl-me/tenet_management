'use client';

import { AlertTriangle, XCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { fadeInUp } from '@/lib/animations';
import type { ReactNode } from 'react';

type ErrorBannerVariant = 'error' | 'warning' | 'info';

const iconMap: Record<ErrorBannerVariant, ReactNode> = {
  error: <XCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <AlertCircle className="h-5 w-5" />,
};

const styles: Record<ErrorBannerVariant, string> = {
  error:
    'border-[color:var(--color-danger-400)] bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-800)]',
  warning:
    'border-[color:var(--color-warning-400)] bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-800)]',
  info: 'border-[color:var(--color-brand-400)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-800)]',
};

export interface ErrorBannerProps {
  message: string;
  variant?: ErrorBannerVariant;
  animate?: boolean;
  className?: string;
}

export function ErrorBanner({
  message,
  variant = 'error',
  animate = true,
  className,
}: ErrorBannerProps) {
  if (!message) return null;

  const content = (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold',
        styles[variant],
        className,
      )}
    >
      <span className="flex-shrink-0">{iconMap[variant]}</span>
      <p>{message}</p>
    </div>
  );

  if (!animate) return content;

  return <motion.div variants={fadeInUp}>{content}</motion.div>;
}
