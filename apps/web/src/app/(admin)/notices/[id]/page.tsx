'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Megaphone, Calendar, Target, FileText, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
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
    api
      .get(`notices/${id}`)
      .json<{ success: boolean; data: NoticeDetail }>()
      .then((res) => {
        setNotice(res.data);
      })
      .catch(() => {
        setError('Failed to load notice');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-t-brand-500 h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-[color:var(--border-color)]" />
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Notice not found'}
        </div>
      </div>
    );
  }

  const priorityVariant =
    notice.priority === 'emergency'
      ? 'danger'
      : notice.priority === 'high'
        ? 'warning'
        : notice.priority === 'medium'
          ? 'info'
          : 'neutral';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">
              {notice.title}
            </h2>
            <p className="text-surface-500 text-sm">Notice ID: {notice._id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={priorityVariant} label={notice.priority} />
          <StatusBadge
            variant={statusToVariant(notice.isPublished ? 'published' : 'draft')}
            label={notice.isPublished ? 'Published' : 'Draft'}
          />
        </div>
      </div>

      {/* Content Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-6 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 flex items-center gap-2 text-lg font-bold">
          <Megaphone className="text-brand-600 h-5 w-5" />
          Notice Content
        </h3>
        <div className="prose prose-sm max-w-none">
          <p className="text-surface-700 whitespace-pre-wrap text-sm leading-relaxed">
            {notice.content}
          </p>
        </div>
      </div>

      {/* Details Card */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Priority</p>
            <StatusBadge variant={priorityVariant} label={notice.priority} />
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Status</p>
            <StatusBadge
              variant={statusToVariant(notice.isPublished ? 'published' : 'draft')}
              label={notice.isPublished ? 'Published' : 'Draft'}
            />
          </div>
          <div>
            <p className="text-surface-800 font-display text-sm font-semibold">Created</p>
            <p className="text-surface-700 flex items-center gap-1 text-sm">
              <Calendar className="text-surface-400 h-3.5 w-3.5" />
              {new Date(notice.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          {notice.targetType && (
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Target Type</p>
              <p className="text-surface-700 flex items-center gap-1 text-sm">
                <Target className="text-surface-400 h-3.5 w-3.5" />
                <span className="capitalize">{notice.targetType}</span>
              </p>
            </div>
          )}
          {notice.targetIds && notice.targetIds.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-surface-800 font-display text-sm font-semibold">Target IDs</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {notice.targetIds.map((tid) => (
                  <code
                    key={tid}
                    className="border-[color:var(--color-surface-300)] bg-surface-50 text-surface-600 rounded border px-2 py-0.5 font-mono text-xs"
                  >
                    {tid}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-[color:var(--color-surface-100)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
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
      </div>
    </div>
  );
}