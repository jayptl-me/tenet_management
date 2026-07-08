'use client';

import { useCallback } from 'react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fadeScaleIn } from '@/lib/animations';
import { Button } from '@/components/ui/Button';

// ── Types ──────────────────────────────────────────────

export interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export function PageHeader({
  title,
  description,
  backHref,
  action,
  badge,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  }, [backHref, router]);

  return (
    <motion.div
      variants={fadeScaleIn}
      initial="hidden"
      animate="visible"
      className={clsx(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {/* Left side */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {backHref !== undefined && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleBack}
            aria-label="Go back"
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-[color:var(--color-text-primary)]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right side */}
      {(action || badge) && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {badge && <span className="flex-shrink-0">{badge}</span>}
          {action && <span className="flex-shrink-0">{action}</span>}
        </div>
      )}
    </motion.div>
  );
}