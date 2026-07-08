'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Home,
  Star,
  FileText,
  Tag,
  UtensilsCrossed,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface MealFeedbackDetail {
  _id: string;
  tenantId?: {
    _id: string;
    userId?: { name: string; email?: string; phone?: string };
    roomId?: { roomNumber: string };
  };
  mealType: string;
  date: string;
  rating: number;
  comment?: string;
  categories?: string[];
  status: string;
  createdAt: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function MealFeedbackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [feedback, setFeedback] = useState<MealFeedbackDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`meals/${id}`)
      .json<{ success: boolean; data: MealFeedbackDetail }>()
      .then((res) => setFeedback(res.data))
      .catch(() => setError('Failed to load meal feedback'))
      .finally(() => setIsLoading(false));
  }, [id]);

  // ── Loading State ────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  // ── Error / Not Found State ──────────────────
  if (error || !feedback) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Meal feedback not found'}</p>
        </div>
      </div>
    );
  }

  const tenantName = feedback.tenantId?.userId?.name ?? 'N/A';
  const roomNumber = feedback.tenantId?.roomId?.roomNumber ?? 'N/A';

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">

      {/* ── Header ─────────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">Meal Feedback</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">
              {tenantName} · Room {roomNumber}
            </p>
          </div>
        </div>
        <StatusBadge
          variant={statusToVariant(feedback.status)}
          label={feedback.status.replace(/_/g, ' ')}
        />
      </motion.div>

      {/* ── Rating Display ──────────────────────── */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Rating</p>
        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-9 w-9 ${i < feedback.rating ? 'fill-[color:var(--color-warning-500)] text-[color:var(--color-warning-500)]' : 'text-[color:var(--color-surface-300)]'}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xl font-bold text-[color:var(--color-text-primary)]">{feedback.rating} / 5</p>
      </motion.div>

      {/* ── Stats Grid ─────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Meal Type"
          value={feedback.mealType.charAt(0).toUpperCase() + feedback.mealType.slice(1)}
          icon={<UtensilsCrossed className="h-4 w-4" />}
          variant="brand"
        />
        <StatCard
          title="Date"
          value={formatDate(feedback.date || feedback.createdAt)}
          icon={<Star className="h-4 w-4" />}
          variant="default"
        />
        <StatCard
          title="Status"
          value={feedback.status.replace(/_/g, ' ')}
          icon={<Tag className="h-4 w-4" />}
          variant={statusToVariant(feedback.status) === 'success' ? 'success' : 'default'}
        />
      </motion.div>

      {/* ── Info Cards ──────────────────────────── */}
      <motion.div variants={fadeScaleIn} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
            <User className="h-5 w-5 text-[color:var(--color-brand-500)]" />Details
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Tenant</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{tenantName}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Room</p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
                <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />{roomNumber}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Meal Type</p>
              <p className="text-[13px] font-semibold capitalize text-[color:var(--color-text-primary)]">{feedback.mealType}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Date</p>
              <p className="text-[13px] font-semibold text-[color:var(--color-text-primary)]">{formatDate(feedback.date || feedback.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {feedback.categories && feedback.categories.length > 0 && (
            <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
                <Tag className="h-5 w-5 text-[color:var(--color-brand-500)]" />Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {feedback.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text-secondary)]"
                  >
                    <Tag className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {feedback.comment && (
            <div className="rounded-xl border border-[color:var(--color-warning-200)] bg-[color:var(--color-warning-50)] p-6 shadow-[var(--shadow-card)]">
              <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[color:var(--color-warning-800)]">
                <FileText className="h-5 w-5" />Comment
              </h3>
              <p className="whitespace-pre-wrap text-sm font-medium text-[color:var(--color-warning-900)]">{feedback.comment}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
