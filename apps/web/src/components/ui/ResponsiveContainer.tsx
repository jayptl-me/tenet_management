'use client';

import { clsx } from 'clsx';

// ── Types ──────────────────────────────────────────────

type ResponsiveContainerElement = 'div' | 'section' | 'article';
type ContainerMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  as?: ResponsiveContainerElement;
  maxWidth?: ContainerMaxWidth;
  className?: string;
}

// ── Max-width map ──────────────────────────────────────

const maxWidthStyles: Record<ContainerMaxWidth, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[90rem]',
  full: 'max-w-full',
};

// ── Component ──────────────────────────────────────────

export function ResponsiveContainer({
  children,
  as: Tag = 'div',
  maxWidth = 'lg',
  className,
}: ResponsiveContainerProps) {
  return (
    <Tag
      className={clsx(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        maxWidthStyles[maxWidth],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
