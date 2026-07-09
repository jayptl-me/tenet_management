'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  User,
  Home,
  Star,
  FileText,
  Tag,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';

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

  if (!isLoading && (error || !feedback)) {
    return (
      <FormPage
        title="Meal Feedback"
        description="View meal feedback details"
        backHref="/meals"
        error={error || 'Meal feedback not found'}
        maxWidth="4xl"
      />
    );
  }

  const tenantName = feedback?.tenantId?.userId?.name ?? 'N/A';
  const roomNumber = feedback?.tenantId?.roomId?.roomNumber ?? 'N/A';

  return (
    <FormPage
      title="Meal Feedback"
      description={feedback ? `${tenantName} · Room ${roomNumber}` : undefined}
      backHref="/meals"
      isLoading={isLoading}
      maxWidth="4xl"
      badge={
        feedback ? (
          <StatusBadge
            variant={statusToVariant(feedback.status)}
            label={feedback.status.replace(/_/g, ' ')}
          />
        ) : undefined
      }
    >
      {feedback && (
        <div className="space-y-6">
          <DetailCard title="Rating" icon={<Star />}>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-9 w-9 ${i < feedback.rating ? 'fill-[color:var(--color-warning-500)] text-[color:var(--color-warning-500)]' : 'text-[color:var(--color-surface-300)]'}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xl font-bold text-[color:var(--color-text-primary)]">
                {feedback.rating} / 5
              </p>
            </div>
          </DetailCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DetailCard title="Details" icon={<User />}>
              <DetailList>
                <DetailRow
                  label="Tenant"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {tenantName}
                    </span>
                  }
                />
                <DetailRow
                  label="Room"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                      {roomNumber}
                    </span>
                  }
                />
                <DetailRow
                  label="Meal Type"
                  value={<span className="capitalize">{feedback.mealType}</span>}
                />
                <DetailRow
                  label="Date"
                  value={formatDate(feedback.date || feedback.createdAt)}
                />
              </DetailList>
            </DetailCard>

            <div className="space-y-6">
              {feedback.categories && feedback.categories.length > 0 && (
                <DetailCard title="Categories" icon={<Tag />}>
                  <div className="flex flex-wrap gap-2">
                    {feedback.categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-color)] bg-[color:var(--color-field-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text-secondary)]"
                      >
                        <Tag className="h-3 w-3 text-[color:var(--color-text-muted)]" />
                        {cat}
                      </span>
                    ))}
                  </div>
                </DetailCard>
              )}

              {feedback.comment && (
                <DetailCard title="Comment" icon={<FileText />} variant="warning">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                    {feedback.comment}
                  </p>
                </DetailCard>
              )}
            </div>
          </div>
        </div>
      )}
    </FormPage>
  );
}
