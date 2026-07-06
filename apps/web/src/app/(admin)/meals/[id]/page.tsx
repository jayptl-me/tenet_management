'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Home, Star, FileText, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';

interface MealFeedbackDetail {
  _id: string;
  tenant?: {
    _id: string;
    user?: { name: string; email?: string; phone?: string };
    room?: { roomNumber: string };
  };
  mealType: string;
  mealDate: string;
  rating: number;
  comment?: string;
  categories?: string[];
  status: string;
  createdAt: string;
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
      .then((res) => {
        setFeedback(res.data);
      })
      .catch(() => {
        setError('Failed to load meal feedback');
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

  if (error || !feedback) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="border-danger-500 bg-danger-100 text-danger-800 rounded-lg border-[length:var(--bw-strong)] p-4 text-sm font-semibold">
          {error || 'Meal feedback not found'}
        </div>
      </div>
    );
  }

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
            <h2 className="font-display text-surface-900 text-2xl font-extrabold">Meal Feedback</h2>
            <p className="text-surface-500 text-sm">Feedback ID: {feedback._id}</p>
          </div>
        </div>
        <StatusBadge variant={statusToVariant(feedback.status)} label={feedback.status} />
      </div>

      {/* Rating Card */}
      <div className="bg-brand-50 rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-surface-800 font-display mb-2 text-sm font-semibold">Rating</p>
        <div className="flex items-center justify-center gap-1 text-4xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-8 w-8 ${i < feedback.rating ? 'fill-warning-500 text-warning-500' : 'text-surface-300'}`}
            />
          ))}
        </div>
        <p className="text-surface-700 font-display mt-1 text-sm font-bold">
          {feedback.rating} / 5
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tenant & Meal Info */}
        <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Details</h3>
          <div className="space-y-4">
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Tenant</p>
              <p className="text-surface-700 flex items-center gap-1 text-sm">
                <User className="text-surface-400 h-3.5 w-3.5" />
                {feedback.tenant?.user?.name ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Room</p>
              <p className="text-surface-700 flex items-center gap-1 text-sm">
                <Home className="text-surface-400 h-3.5 w-3.5" />
                {feedback.tenant?.room?.roomNumber ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Meal Type</p>
              <p className="text-surface-700 text-sm capitalize">{feedback.mealType}</p>
            </div>
            <div>
              <p className="text-surface-800 font-display text-sm font-semibold">Date</p>
              <p className="text-surface-700 text-sm">
                {new Date(feedback.mealDate || feedback.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {feedback.categories && feedback.categories.length > 0 && (
            <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
              <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {feedback.categories.map((cat) => (
                  <span
                    key={cat}
                    className="bg-surface-50 text-surface-700 inline-flex items-center gap-1 rounded-md border-[length:var(--bw-default)] border-[color:var(--border-color)] px-3 py-1 text-xs font-semibold"
                  >
                    <Tag className="h-3 w-3" />
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {feedback.comment && (
            <div className="rounded-lg border-[length:var(--bw-strong)] border-[color:var(--border-color)] bg-white p-5 shadow-[var(--shadow-card)]">
              <h3 className="font-display text-surface-900 mb-4 text-lg font-bold">Comment</h3>
              <p className="text-surface-700 flex items-start gap-1 text-sm">
                <FileText className="text-surface-400 mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-pre-wrap">{feedback.comment}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
