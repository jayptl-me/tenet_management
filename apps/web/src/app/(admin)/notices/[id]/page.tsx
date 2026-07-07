'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Megaphone, Calendar, Target, FileText, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
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

function priorityBadge(priority: string) {
  if (priority === 'emergency') {
    return (
      <span className="inline-flex rounded-full border-2 border-red-400 bg-red-50 px-3 py-0.5 text-xs font-black text-red-700 shadow-[2px_2px_0px_0px_#fca5a5]">
        {priority}
      </span>
    );
  }
  if (priority === 'high') {
    return (
      <span className="inline-flex rounded-full border-2 border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-black text-amber-700 shadow-[2px_2px_0px_0px_#fcd34d]">
        {priority}
      </span>
    );
  }
  if (priority === 'medium') {
    return (
      <span className="inline-flex rounded-full border-2 border-blue-300 bg-blue-50 px-3 py-0.5 text-xs font-black text-blue-700">
        {priority}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border-2 border-gray-300 bg-gray-50 px-3 py-0.5 text-xs font-black text-gray-600">
      {priority}
    </span>
  );
}

function publishedBadge(isPublished: boolean) {
  if (isPublished) {
    return (
      <span className="inline-flex rounded-full border-2 border-emerald-400 bg-emerald-50 px-3 py-0.5 text-xs font-black text-emerald-700">
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border-2 border-gray-300 bg-gray-50 px-3 py-0.5 text-xs font-black text-gray-600">
      Draft
    </span>
  );
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-[var(--radius-lg)] border-2 border-red-400 bg-red-50 p-5 text-red-800 font-semibold shadow-[4px_4px_0px_0px_#ef4444]">
          {error || 'Notice not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-300 bg-white p-2 font-semibold text-gray-900 shadow-[2px_2px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h2 className="font-black text-2xl text-gray-900 tracking-tight">
              {notice.title}
            </h2>
            <p className="text-sm text-gray-500">Notice ID: {notice._id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {priorityBadge(notice.priority)}
          {publishedBadge(notice.isPublished)}
        </div>
      </div>

      {/* Content Card */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-6 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="mb-4 flex items-center gap-2 font-black text-lg text-gray-900">
          <Megaphone className="h-5 w-5 text-gray-700" />
          Notice Content
        </h3>
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {notice.content}
          </p>
        </div>
      </div>

      {/* Details Card */}
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="mb-4 font-black text-lg text-gray-900">Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">Priority</p>
            <div className="mt-1">{priorityBadge(notice.priority)}</div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Status</p>
            <div className="mt-1">{publishedBadge(notice.isPublished)}</div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Created</p>
            <p className="flex items-center gap-1 text-sm text-gray-700">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {formatDate(notice.createdAt)}
            </p>
          </div>
          {notice.targetType && (
            <div>
              <p className="text-sm font-semibold text-gray-700">Target Type</p>
              <p className="flex items-center gap-1 text-sm text-gray-700">
                <Target className="h-3.5 w-3.5 text-gray-400" />
                <span className="capitalize">{notice.targetType}</span>
              </p>
            </div>
          )}
          {notice.targetIds && notice.targetIds.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-gray-700">Target IDs</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {notice.targetIds.map((tid) => (
                  <code
                    key={tid}
                    className="rounded border-2 border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-600"
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
      <div className="rounded-[var(--radius-lg)] border-2 border-gray-300 bg-white p-5 shadow-[4px_4px_0px_0px_#d1d5db]">
        <h3 className="mb-4 font-black text-lg text-gray-900">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const phone = process.env.NEXT_PUBLIC_PG_PHONE ?? '';
              const text = `${notice.title}: ${notice.content}`;
              const url = generateWhatsAppUrl(phone, text);
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border-2 border-gray-900 bg-gray-900 px-4 py-2 font-semibold text-white shadow-[4px_4px_0px_0px_#d1d5db] transition-all hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
          >
            <MessageCircle className="h-4 w-4" />
            Share via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}