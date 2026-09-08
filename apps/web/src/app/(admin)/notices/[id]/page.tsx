'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Megaphone, Calendar, Target, MessageCircle, Info, Copy, Pencil, User } from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { generateWhatsAppUrl, copyToClipboard } from '@/lib/whatsapp';
import { floorLabel, roomLabel, tenantLabel } from '@/lib/resource-select-presets';
import { toast } from 'sonner';

interface NoticeDetail {
  _id: string;
  title: string;
  content: string;
  pinned?: boolean;
  targetType?: string;
  targetIds?: string[];
  author?: { _id: string; name: string; email: string };
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

export default function NoticeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetNames, setTargetNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    api
      .get(`notices/${id}`)
      .json<{ success: boolean; data: NoticeDetail }>()
      .then((res) => {
        setNotice(res.data);
        void resolveTargetNames(res.data);
      })
      .catch(async (err) => {
        setError((await parseApiError(err)).message);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  async function resolveTargetNames(data: NoticeDetail) {
    const ids = data.targetIds ?? [];
    if (ids.length === 0 || !data.targetType || data.targetType === 'all') return;
    try {
      const names: Record<string, string> = {};
      if (data.targetType === 'floor') {
        const res = await api.get('floors').json<{
          success: boolean;
          data: Array<{ _id: string; label?: string; floorNumber?: number }>;
        }>();
        for (const f of res.data ?? []) {
          if (ids.includes(f._id)) names[f._id] = floorLabel(f);
        }
      } else if (data.targetType === 'room') {
        const res = await api.get('rooms?limit=100').json<{
          success: boolean;
          data: Array<{
            _id: string;
            roomNumber?: string;
            sharingType?: number;
            monthlyRent?: number;
          }>;
        }>();
        for (const r of res.data ?? []) {
          if (ids.includes(r._id)) names[r._id] = roomLabel(r);
        }
      } else if (data.targetType === 'individual') {
        // Individual targets are user IDs; resolve via tenant user links.
        const res = await api.get('tenants?limit=100').json<{
          success: boolean;
          data: Array<{
            _id: string;
            user?: { _id?: string; name?: string };
            userId?: { _id?: string; name?: string } | string;
            room?: { roomNumber?: string };
          }>;
        }>();
        for (const t of res.data ?? []) {
          const userDoc = t.user ?? (typeof t.userId === 'object' ? t.userId : undefined);
          const userDocId = userDoc?._id ? String(userDoc._id) : '';
          if (userDocId && ids.includes(userDocId)) {
            names[userDocId] = tenantLabel(t as Parameters<typeof tenantLabel>[0]);
          }
        }
      }
      setTargetNames(names);
    } catch {
      // Names stay unresolved; raw IDs still render below
    }
  }

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

  return (
    <FormPage
      title={notice?.title ?? 'Notice Details'}
      description={notice ? `Notice ID: ${notice._id}` : undefined}
      backHref="/notices"
      isLoading={isLoading}
      maxWidth="4xl"
      actions={
        notice ? (
          <Button variant="outline" onClick={() => router.push(`/notices/${notice._id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit Notice
          </Button>
        ) : undefined
      }
      badge={
        notice ? (
          <div className="flex items-center gap-2">
            <StatusBadge
              variant={notice.pinned ? 'warning' : 'neutral'}
              label={notice.pinned ? 'Pinned' : 'Normal'}
            />
            {notice.targetType && (
              <StatusBadge variant="info" label={notice.targetType.replace(/_/g, ' ')} />
            )}
          </div>
        ) : undefined
      }
    >
      {notice && (
        <div className="space-y-6">
          <DetailCard title="Notice Content" icon={<Megaphone />}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
              {notice.content}
            </p>
          </DetailCard>

          <DetailCard title="Details" icon={<Info />}>
            <DetailList>
              <DetailRow
                label="Pinned"
                value={
                  <StatusBadge
                    variant={notice.pinned ? 'warning' : 'neutral'}
                    label={notice.pinned ? 'Pinned' : 'Normal'}
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
              {notice.author && (
                <DetailRow
                  label="Author"
                  value={
                    <span className="inline-flex items-center gap-1 font-medium text-[color:var(--color-text-primary)]">
                      <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {notice.author.name} {notice.author.email ? `(${notice.author.email})` : ''}
                    </span>
                  }
                />
              )}
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
                  label="Targets"
                  value={
                    <div className="flex flex-wrap justify-end gap-1">
                      {notice.targetIds.map((tid) => (
                        <span
                          key={tid}
                          title={tid}
                          className="rounded-md border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--color-text-secondary)]"
                        >
                          {targetNames[tid] ?? tid}
                        </span>
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
              <Button
                variant="outline"
                onClick={async () => {
                  await copyToClipboard(`${notice.title}\n\n${notice.content}`);
                  toast.success('Notice copied to clipboard');
                }}
              >
                <Copy className="h-4 w-4" />
                Copy Text
              </Button>
            </div>
          </DetailCard>
        </div>
      )}
    </FormPage>
  );
}
