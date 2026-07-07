'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Megaphone, Calendar, Target, MessageCircle, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { generateWhatsAppUrl } from '@/lib/whatsapp';
import { motion } from 'motion/react';
import { staggerContainerFast, fadeScaleIn } from '@/lib/animations';

interface NoticeDetail {
  _id: string;
  title: string;
  content: string;
  priority: string;
  isPublished: boolean;
  targetType?: string;
  targetIds?: string[];
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

const priorityVariantMap: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  emergency: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

export default function NoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api.get(`notices/${id}`).json<{ success: boolean; data: NoticeDetail }>()
      .then((res) => setNotice(res.data))
      .catch(() => setError('Failed to load notice'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--color-text-muted)]" />
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-xl border border-[color:var(--color-danger-200)] bg-[color:var(--color-danger-50)] p-6 text-center shadow-[var(--shadow-sm)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--color-danger-500)]" />
          <p className="mt-3 font-semibold text-[color:var(--color-danger-700)]">{error || 'Notice not found'}</p>
        </div>
      </div>
    );
  }

  const priorityVariant = priorityVariantMap[notice.priority] ?? 'neutral';

  return (
    <motion.div variants={staggerContainerFast} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={fadeScaleIn} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">{notice.title}</h2>
            <p className="mt-0.5 text-[13px] font-medium text-[color:var(--color-text-muted)]">Notice ID: {notice._id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={priorityVariant} label={notice.priority} />
          <StatusBadge variant={notice.isPublished ? 'success' : 'neutral'} label={notice.isPublished ? 'Published' : 'Draft'} />
        </div>
      </motion.div>

      {/* Content */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[color:var(--color-text-primary)]">
          <Megaphone className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
          Notice Content
        </h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">{notice.content}</p>
      </motion.div>

      {/* Details */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Priority</p>
            <div className="mt-1"><StatusBadge variant={priorityVariant} label={notice.priority} /></div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</p>
            <div className="mt-1"><StatusBadge variant={notice.isPublished ? 'success' : 'neutral'} label={notice.isPublished ? 'Published' : 'Draft'} /></div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Created</p>
            <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--color-text-primary)]">
              <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
              {formatDate(notice.createdAt)}
            </p>
          </div>
          {notice.targetType && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Target Type</p>
              <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold capitalize text-[color:var(--color-text-primary)]">
                <Target className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                {notice.targetType}
              </p>
            </div>
          )}
          {notice.targetIds && notice.targetIds.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">Target IDs</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {notice.targetIds.map((tid) => (
                  <code key={tid} className="rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-surface-50)] px-2 py-0.5 font-mono text-xs font-semibold text-[color:var(--color-text-secondary)]">
                    {tid}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeScaleIn} className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-4 text-lg font-bold text-[color:var(--color-text-primary)]">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => {
              const phone = process.env.NEXT_PUBLIC_PG_PHONE ?? '';
              const text = `${notice.title}: ${notice.content}`;
              const url = generateWhatsAppUrl(phone, text);
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Share via WhatsApp
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
