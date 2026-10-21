'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  User,
  Star,
  FileText,
  Tag,
  Pencil,
  Check,
  MessageSquare,
  Bell,
  UtensilsCrossed,
  Info,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { errorMessage } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { StatusBadge, statusToVariant } from '@/components/ui/StatusBadge';
import { FormPage } from '@/components/ui/FormPage';
import { ContentFrame } from '@/components/ui/ContentFrame';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { StarRating } from '@/components/ui/StarRating';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /meals/:id           apps/api/src/routes/meals.ts:404-428
//   PUT /meals/:id           apps/api/src/routes/meals.ts:431-513
//   GET /audit-logs          apps/api/src/routes/audit.ts:13-52

interface MealFeedbackDetail {
  _id: string;
  date: string;
  mealType: string;
  rating: number;
  status: string;
  comment?: string;
  categories?: string[];
  createdAt: string;
  tenant?: {
    _id?: string;
    bedId?: string | null;
    user?: { _id?: string; name?: string; email?: string; phone?: string } | null;
    room?: {
      _id?: string;
      roomNumber?: string;
      floor?: { _id?: string; label?: string } | null;
    } | null;
  } | null;
}

/** One entry of the write trail of this rating. */
interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  actioned: 'Actioned',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * A day of the ledger, written out of the string the server holds.
 *
 * The meal day is a plain YYYY-MM-DD string (apps/api/src/models/mealFeedback.ts:21-26),
 * so it is read letter by letter: a Date would move it a day in a timezone
 * west of Greenwich.
 */
function formatDay(day: string | undefined | null): string {
  if (!day) return 'unknown';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const month = MONTHS[Number(match[2]) - 1];
  return `${Number(match[3])} ${month ?? match[2]} ${match[1]}`;
}

/** A timestamp of the server, written in the operator's timezone. */
function formatStamp(stamp: string | undefined | null): string {
  if (!stamp) return 'unknown';
  const parsed = new Date(stamp);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The message the server pushes to the resident when the status moves.
 *
 * The wording is the server's (apps/api/src/routes/meals.ts:484-492): it names
 * the meal and the day of the rating, and it says whether the office read the
 * rating or acted on it.
 */
function residentMessage(mealType: string, day: string, next: 'acknowledged' | 'actioned'): string {
  return next === 'actioned'
    ? `We have acted on your feedback about the ${mealType} on ${day}.`
    : `We have read your feedback about the ${mealType} on ${day}.`;
}

/**
 * One line of the write trail of a rating.
 *
 * The audit entry is the proof of what the office did, and the details the
 * server wrote with it are what the office is told.
 */
function auditSummary(entry: AuditEntry): string {
  const details = entry.details ?? {};
  if (entry.action === 'create') {
    const rating = typeof details.rating === 'number' ? details.rating : null;
    return `The office recorded this rating on the resident's behalf${
      rating !== null ? `, with ${rating} of 5 stars` : ''
    }. The server wrote a create entry in the audit log.`;
  }
  if (entry.action === 'delete') {
    return 'The rating was deleted. The record is gone; the entry keeps the day, the meal and the rating.';
  }

  const moved: string[] = [];
  if (typeof details.status === 'string') moved.push(`the status became ${details.status}`);
  if (typeof details.rating === 'number') moved.push(`the rating became ${details.rating}`);
  if (typeof details.mealType === 'string') moved.push(`the meal became ${details.mealType}`);
  if (Array.isArray(details.categories)) {
    const cats = details.categories.filter((entryValue): entryValue is string => {
      return typeof entryValue === 'string';
    });
    moved.push(`the categories became ${cats.join(', ')}`);
  }
  if (typeof details.comment === 'string') moved.push('the comment was rewritten');
  return moved.length > 0
    ? `The office wrote this rating: ${moved.join(', ')}.`
    : 'The office wrote this rating.';
}

const MEAL_KEY = (id: string) => ['meals', id] as const;
const MEAL_AUDIT_KEY = (id: string) => ['meals', id, 'audit'] as const;

export default function MealFeedbackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [error, setError] = useState('');
  const [writeResult, setWriteResult] = useState('');
  const [writing, setWriting] = useState<string | null>(null);

  const {
    data: rawFeedback,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<MealFeedbackDetail>(MEAL_KEY(id), `meals/${id}`, { enabled: Boolean(id) });
  const queryErrorMessage = errorMessage(queryError);

  /**
   * The server answers with one rating object. Anything else is not a rating,
   * and the page says so instead of rendering an empty record.
   */
  const feedback = rawFeedback && !Array.isArray(rawFeedback) ? rawFeedback : null;

  /**
   * The write trail of this rating.
   *
   * The audit route filters by the record, so this is the trail of this rating
   * and not of every rating (apps/api/src/routes/audit.ts:19-20). The server
   * keeps the entries for 90 days.
   */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    MEAL_AUDIT_KEY(id),
    `audit-logs?resource=meal_feedback&resourceId=${id}&limit=20`,
    { enabled: Boolean(id) },
  );

  /**
   * Answer the rating from where it stands.
   *
   * The server writes the new status, writes an update entry in the audit log
   * and pushes a meal_feedback message to the resident who left the rating
   * (apps/api/src/routes/meals.ts:481-494). The record is read back from the
   * server afterwards: the screen shows the server's state, never a local
   * claim about it.
   */
  const handleStatus = async (next: 'acknowledged' | 'actioned') => {
    if (!id) return;
    setWriting(next);
    setError('');
    setWriteResult('');
    try {
      const res = await api
        .put(`meals/${id}`, { json: { status: next } })
        .json<{ success: boolean; data: MealFeedbackDetail }>();
      await queryClient.invalidateQueries({ queryKey: MEAL_KEY(id) });
      await queryClient.invalidateQueries({ queryKey: MEAL_AUDIT_KEY(id) });
      const committed = res.data?.status ?? 'unknown';
      const message = residentMessage(
        feedback?.mealType ?? 'meal',
        feedback?.date ?? 'the day of the rating',
        next,
      );
      setWriteResult(
        `The server wrote the status "${committed}". The resident who left this rating reads a meal_feedback message in their portal: "${message}" A push that fails is logged by the server and is not reported back here, so this screen cannot prove the resident received it.`,
      );
    } catch (err) {
      setError((await parseApiError(err)).message);
    } finally {
      setWriting(null);
    }
  };

  if (!isLoading && (queryErrorMessage || !feedback)) {
    return (
      <FormPage
        title="Meal feedback"
        description="What the residents said about the food"
        backHref="/meals"
        error={queryErrorMessage || 'The server reports no meal feedback for this id.'}
        maxWidth="full"
      />
    );
  }

  const tenant = feedback?.tenant ?? null;
  const residentName = tenant?.user?.name ?? 'A resident the server no longer holds';
  const roomNumber = tenant?.room?.roomNumber ?? 'no room';
  const roomLabel = tenant?.room?.roomNumber ? `Room ${tenant.room.roomNumber}` : 'no room';
  const mealLabel = MEAL_LABELS[feedback?.mealType ?? ''] ?? feedback?.mealType ?? 'Meal';
  const day = feedback?.date ?? '';
  const status = feedback?.status ?? 'submitted';
  const tenantId = tenant?._id;
  const roomId = tenant?.room?._id;

  return (
    <FormPage
      title="Meal feedback"
      description={
        feedback
          ? `${residentName} · ${roomLabel} · ${mealLabel} of ${formatDay(day)}`
          : 'What the residents said about the food'
      }
      backHref="/meals"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        <StatusBadge variant={statusToVariant(status)} label={STATUS_LABELS[status] ?? status} />
      }
      actions={
        feedback ? (
          <div className="flex items-center gap-2">
            {feedback.status === 'submitted' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleStatus('acknowledged')}
                loading={writing === 'acknowledged'}
              >
                <MessageSquare className="h-4 w-4" />
                Acknowledge
              </Button>
            )}
            {feedback.status !== 'actioned' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleStatus('actioned')}
                loading={writing === 'actioned'}
              >
                <Check className="h-4 w-4" />
                Mark actioned
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
        <ContentFrame
          rail={
            <>
              {/* Who left the rating. The office needs the resident to answer
                  the rating, not only the record of it. */}
              <DetailCard title="Who left this rating" icon={<User />}>
                <DetailList>
                  <DetailRow
                    label="Resident"
                    value={
                      tenantId ? (
                        <Link
                          href={`/tenants/${tenantId}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {residentName}
                        </Link>
                      ) : (
                        residentName
                      )
                    }
                  />
                  <DetailRow label="Phone" value={tenant?.user?.phone ?? 'not reported'} />
                  <DetailRow label="Email" value={tenant?.user?.email ?? 'not reported'} />
                  <DetailRow
                    label="Room"
                    value={
                      roomId ? (
                        <Link
                          href={`/rooms/${roomId}`}
                          className="font-semibold text-(--color-brand-600) hover:underline"
                        >
                          {roomNumber}
                        </Link>
                      ) : (
                        roomNumber
                      )
                    }
                  />
                  <DetailRow label="Bed" value={tenant?.bedId ?? 'no bed'} />
                  <DetailRow label="Floor" value={tenant?.room?.floor?.label ?? 'no floor'} />
                  <DetailRow label="First written" value={formatStamp(feedback.createdAt)} />
                </DetailList>
                <p className="text-2xs mt-3 font-medium text-(--color-text-muted)">
                  Residents leave this rating in their portal, once per day and meal. The office can
                  also record a rating on their behalf, and that write tells the resident nothing.
                </p>
              </DetailCard>

              {/* What the resident was told. The exact words the server sends,
                  and the truth about the push. */}
              <DetailCard title="What the resident was told" icon={<Bell />}>
                {status === 'submitted' ? (
                  <>
                    <p className="text-2xs font-medium text-(--color-text-secondary)">
                      Nothing yet. The office has not answered this rating, so the resident has not
                      been told anything about it. When the status moves, the server pushes the
                      resident one of these two:
                    </p>
                    <p className="mt-2 text-sm font-semibold text-(--color-text-primary)">
                      &quot;{residentMessage(feedback.mealType, day, 'acknowledged')}&quot;
                    </p>
                    <p className="mt-1 text-sm font-semibold text-(--color-text-primary)">
                      &quot;{residentMessage(feedback.mealType, day, 'actioned')}&quot;
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xs font-medium text-(--color-text-secondary)">
                      When the status moved to {STATUS_LABELS[status] ?? status}, the server pushed
                      the resident this:
                    </p>
                    <p className="mt-2 text-sm font-semibold text-(--color-text-primary)">
                      &quot;
                      {residentMessage(
                        feedback.mealType,
                        day,
                        status === 'actioned' ? 'actioned' : 'acknowledged',
                      )}
                      &quot;
                    </p>
                  </>
                )}
                <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
                  The wording names the meal and the day as they stood when the status moved. A push
                  that fails is logged by the server and the failure is not reported back, so this
                  screen cannot prove that the resident received it. The resident reads it in their
                  portal.
                </p>
              </DetailCard>
            </>
          }
        >
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--color-brand-200) bg-(--color-brand-50) px-4 py-3 text-xs font-semibold text-(--color-brand-900)">
              {writeResult}
            </div>
          )}

          {(error || queryErrorMessage) && <ErrorBanner message={error || queryErrorMessage} />}

          {/* The protagonist of this module: the rating the resident left, in
              the scale the server holds it. */}
          <DetailCard
            title="The rating"
            icon={<Star />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                {formatDay(day)} · {mealLabel}
              </span>
            }
          >
            <div className="flex flex-wrap items-center gap-4">
              <StarRating value={feedback.rating} readonly size="lg" />
              <span className="font-display text-2xl font-bold text-(--color-warning-500)">
                {feedback.rating} / 5
              </span>
            </div>
            {feedback.categories && feedback.categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {feedback.categories.map((category) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1 rounded-full border border-(--border-color) bg-(--color-field-bg) px-3 py-1 text-xs font-semibold text-(--color-text-secondary) capitalize"
                  >
                    <Tag className="h-3 w-3 text-(--color-text-muted)" />
                    {category}
                  </span>
                ))}
              </div>
            )}
            <p className="text-2xs mt-4 font-medium text-(--color-text-muted)">
              <Info className="mr-1 inline h-3 w-3" />
              The number is the resident&apos;s own: the server stores the rating of the meal, from
              1 to 5, and nothing on this page averages it. The rating of a whole meal service is
              computed by the server on the list page, not here.
            </p>
          </DetailCard>

          {/* What the resident said. The words are the record: the office
              answers a comment, not a number. */}
          <DetailCard title="What the resident said" icon={<FileText />}>
            {feedback.comment && feedback.comment.trim() !== '' ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-(--color-text-secondary)">
                {feedback.comment}
              </p>
            ) : (
              <p className="text-sm font-medium text-(--color-text-muted)">
                The resident left a rating without a comment.
              </p>
            )}
          </DetailCard>

          {/* What the office did. The write trail of this record, and the only
              place a change that reached nobody shows up. */}
          <DetailCard
            title="What the office did to this rating"
            icon={<UtensilsCrossed />}
            action={
              <span className="text-2xs font-semibold text-(--color-text-muted)">
                the newest {auditTrail?.length ?? 0} entries
              </span>
            }
          >
            {!auditTrail || auditTrail.length === 0 ? (
              <p className="text-2xs font-medium text-(--color-text-secondary)">
                The server holds no write entry for this rating in the entries it keeps (the entries
                expire after 90 days). A rating the resident left in the portal writes no entry at
                all, so the trail starts with the office&apos;s first write.
              </p>
            ) : (
              <ul className="space-y-2">
                {auditTrail.map((entry) => (
                  <li
                    key={entry._id}
                    className="flex flex-col gap-0.5 border-b border-(--border-color) pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        variant={
                          entry.action === 'delete'
                            ? 'danger'
                            : entry.action === 'create'
                              ? 'success'
                              : 'neutral'
                        }
                        label={entry.action.replace(/_/g, ' ')}
                        size="xs"
                      />
                      <span className="text-2xs font-semibold text-(--color-text-primary)">
                        {entry.userId?.name ?? 'The office'}
                      </span>
                      <span className="text-2xs font-medium text-(--color-text-muted)">
                        {formatStamp(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-2xs font-medium text-(--color-text-secondary)">
                      {auditSummary(entry)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </DetailCard>

          {/* The next step, and the truth about what it commits. */}
          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />
            {status === 'submitted' ? (
              <>
                This rating is waiting to be read: the office has not answered it and the resident
                has not been told. Acknowledging it tells the resident it was read; marking it
                actioned tells the resident the kitchen did something about it. Both writes the
                status and an entry in the audit log, and both push a message to the resident.
              </>
            ) : status === 'acknowledged' ? (
              <>
                The office has read this rating and the resident was told it was read. The next step
                is to act on it: the kitchen changes something, the status becomes actioned and the
                resident is told that too. The record carries no stamp of the moment it was read, so
                how long it waited cannot be read from here.
              </>
            ) : (
              <>
                The kitchen acted on this rating and the resident was told. The record carries no
                stamp of the moment it was actioned, and the write trail expires after 90 days, so
                this is the only place the proof of the office&apos;s answer lives.
              </>
            )}
          </p>
        </ContentFrame>
      )}
    </FormPage>
  );
}
