'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  User,
  Home,
  Star,
  FileText,
  Tag,
  UtensilsCrossed,
  Pencil,
  Check,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { StarRating } from '@/components/ui/StarRating';

interface MealFeedbackDetail {
  _id: string;
  tenantId?: unknown;
  tenant?: {
    _id?: string;
    bedId?: string | null;
    user?: { name?: string; email?: string; phone?: string };
    room?: { roomNumber?: string; floor?: { label?: string } | null };
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
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

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

  const handleUpdateStatus = async (newStatus: 'acknowledged' | 'actioned') => {
    if (!id) return;
    setStatusUpdating(newStatus);
    try {
      const res = await api
        .put(`meals/${id}`, { json: { status: newStatus } })
        .json<{ success: boolean; data: MealFeedbackDetail }>();
      if (res.success) {
        setFeedback(res.data);
      }
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setStatusUpdating(null);
    }
  };

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

  const tenant = feedback?.tenant;
  const tenantName = tenant?.user?.name ?? 'N/A';
  const roomNumber = tenant?.room?.roomNumber ?? 'N/A';
  const bedId = tenant?.bedId ?? null;
  const floorLabel = tenant?.room?.floor?.label ?? null;

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
      actions={
        feedback ? (
          <div className="flex items-center gap-2">
            {feedback.status === 'submitted' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleUpdateStatus('acknowledged')}
                loading={statusUpdating === 'acknowledged'}
              >
                <Clock className="h-4 w-4" />
                Acknowledge
              </Button>
            )}
            {feedback.status !== 'actioned' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleUpdateStatus('actioned')}
                loading={statusUpdating === 'actioned'}
              >
                <Check className="h-4 w-4" />
                Mark Actioned
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/meals/${feedback._id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      {feedback && (
        <div className="space-y-6">
          <DetailCard title="Rating" icon={<Star />}>
            <div className="text-center">
              <div className="flex items-center justify-center">
                <StarRating value={feedback.rating} readonly size="lg" />
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
                {bedId && <DetailRow label="Bed" value={bedId} />}
                {floorLabel && <DetailRow label="Floor" value={floorLabel} />}
                <DetailRow
                  label="Meal Type"
                  value={<span className="capitalize">{feedback.mealType}</span>}
                />
                <DetailRow label="Date" value={formatDate(feedback.date || feedback.createdAt)} />
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
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-[color:var(--color-text-secondary)]">
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
