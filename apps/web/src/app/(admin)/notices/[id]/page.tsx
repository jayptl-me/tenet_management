'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Megaphone, Calendar, Target, MessageCircle, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { generateWhatsAppUrl } from '@/lib/whatsapp';

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
  const id = params.id as string;

  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`notices/${id}`)
      .json<{ success: boolean; data: NoticeDetail }>()
      .then((res) => setNotice(res.data))
      .catch(() => setError('Failed to load notice'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!isLoading && (error || !notice)) {
    return (
      <FormPage
        title="Notice Details"
        description="View notice information"
        backHref="/notices"
        error={error || 'Notice not found'}
        maxWidth="4xl"
      />
    );
  }

  const priorityVariant = notice ? (priorityVariantMap[notice.priority] ?? 'neutral') : 'neutral';

  return (
    <FormPage
      title={notice?.title ?? 'Notice Details'}
      description={notice ? `Notice ID: ${notice._id}` : undefined}
      backHref="/notices"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        notice ? (
          <div className="flex items-center gap-2">
            <StatusBadge variant={priorityVariant} label={notice.priority} />
            <StatusBadge
              variant={notice.isPublished ? 'success' : 'neutral'}
              label={notice.isPublished ? 'Published' : 'Draft'}
            />
          </div>
        ) : undefined
      }
    >
      {notice && (
        <div className="space-y-6">
          <DetailCard title="Notice Content" icon={<Megaphone />}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
              {notice.content}
            </p>
          </DetailCard>

          <DetailCard title="Details" icon={<Info />}>
            <DetailList>
              <DetailRow
                label="Priority"
                value={<StatusBadge variant={priorityVariant} label={notice.priority} />}
              />
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    variant={notice.isPublished ? 'success' : 'neutral'}
                    label={notice.isPublished ? 'Published' : 'Draft'}
                  />
                }
              />
              <DetailRow
                label="Created"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    {formatDate(notice.createdAt)}
                  </span>
                }
              />
              {notice.targetType && (
                <DetailRow
                  label="Target Type"
                  value={
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Target className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {notice.targetType}
                    </span>
                  }
                />
              )}
              {notice.targetIds && notice.targetIds.length > 0 && (
                <DetailRow
                  label="Target IDs"
                  value={
                    <div className="flex flex-wrap justify-end gap-1">
                      {notice.targetIds.map((tid) => (
                        <code
                          key={tid}
                          className="rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2 py-0.5 font-mono text-xs font-semibold text-[color:var(--color-text-secondary)]"
                        >
                          {tid}
                        </code>
                      ))}
                    </div>
                  }
                />
              )}
            </DetailList>
          </DetailCard>

          <DetailCard title="Actions" icon={<MessageCircle />}>
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
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
