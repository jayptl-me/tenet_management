'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  Cookie,
  Copy,
  Info,
  MessageCircle,
  Moon,
  Pencil,
  Sun,
  Sunset,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/errorParser';
import { ApiQueryError, errorMessage, queryJson } from '@/lib/query';
import { useApiQuery } from '@/hooks/useApiQuery';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DatePicker } from '@/components/ui/DatePicker';
import { DetailCard, DetailList, DetailRow } from '@/components/ui/DetailCard';
import { FormPage } from '@/components/ui/FormPage';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Timeline } from '@/components/ui/Timeline';
import { generateWhatsAppUrl } from '@/lib/whatsapp';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /menus/:id        apps/api/src/routes/menus.ts:169-177
//   PUT /menus/:id        apps/api/src/routes/menus.ts:180-244
//   DELETE /menus/:id     apps/api/src/routes/menus.ts:247-279
//   GET /audit-logs       apps/api/src/routes/audit.ts:13-52
// The menu model carries no status field (apps/api/src/models/dailyMenu.ts):
// a day is planned or it is not, and the date decides whether it is past.

interface MenuMealItem {
  name: string;
  description?: string;
  category?: string;
}

interface MenuDayRecord {
  _id: string;
  date: string;
  meals: {
    breakfast?: MenuMealItem[];
    lunch?: MenuMealItem[];
    snacks?: MenuMealItem[];
    dinner?: MenuMealItem[];
  };
  /** Derived by the server: the date is today or later (menus.ts:33-41). */
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** One entry of the write trail of a day. */
interface AuditEntry {
  _id: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  userId?: { name?: string } | null;
}

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: Sun },
  { key: 'lunch', label: 'Lunch', icon: Sunset },
  { key: 'snacks', label: 'Snacks', icon: Cookie },
  { key: 'dinner', label: 'Dinner', icon: Moon },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "Monday, 19 October 2026". */
function longDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** The dishes of a slot, the way the server holds them. */
function dishesOf(menu: MenuDayRecord, slot: keyof MenuDayRecord['meals']): MenuMealItem[] {
  return menu.meals?.[slot] ?? [];
}

/** The payload of a write: the four slots of a day (apps/api/src/routes/menus.ts:23-31). */
function mealsPayload(menu: MenuDayRecord): MenuDayRecord['meals'] {
  return {
    breakfast: dishesOf(menu, 'breakfast'),
    lunch: dishesOf(menu, 'lunch'),
    snacks: dishesOf(menu, 'snacks'),
    dinner: dishesOf(menu, 'dinner'),
  };
}

/** How many of the four slots of a day hold no dish. */
function emptySlotCount(menu: MenuDayRecord): number {
  return MEAL_SLOTS.filter((slot) => dishesOf(menu, slot.key).length === 0).length;
}

export default function MenuDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyDate, setCopyDate] = useState('');
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<MenuDayRecord | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState('');
  const [actionError, setActionError] = useState('');
  const [writeResult, setWriteResult] = useState('');

  /**
   * The day.
   *
   * The route answers for an id and for a date (apps/api/src/routes/menus.ts:172-174),
   * so a link to /menus/2026-10-22 opens the same day as a link to its record.
   */
  const {
    data: menu,
    isPending: isLoading,
    error: queryError,
  } = useApiQuery<MenuDayRecord>(['menus', 'detail', id], `menus/${id}`, { enabled: Boolean(id) });
  const queryErrorMessage = errorMessage(queryError);

  /**
   * The write trail of this day.
   *
   * The audit route filters by the record, so this is the trail of this day
   * and not of every day (apps/api/src/routes/audit.ts:13-52).
   */
  const { data: auditTrail } = useApiQuery<AuditEntry[]>(
    ['menus', 'audit', menu?._id ?? id],
    `audit-logs?resource=daily_menu&resourceId=${menu?._id ?? id}&limit=20`,
    { enabled: Boolean(menu?._id) },
  );

  const isPast = menu ? menu.isActive === false : false;
  const emptySlots = menu ? emptySlotCount(menu) : 0;
  const stateLabel = !menu ? '' : emptySlots === 0 ? 'Planned' : 'Partly planned';
  const stateVariant = !menu ? 'neutral' : emptySlots === 0 ? 'success' : 'warning';

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['menus'] });
  };

  const handleDelete = async () => {
    if (!menu) return;
    setDeleting(true);
    setActionError('');
    try {
      await api.delete(`menus/${menu._id}`).json();
      setWriteResult(
        `The day was deleted and the server wrote an update entry in the audit log. The residents read the day when they open the portal.`,
      );
      refresh();
      router.push('/menus');
    } catch (err) {
      setActionError((await parseApiError(err)).message);
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The copy of this day onto another day.
   *
   * The target is read first, so the operator is told what the copy overwrites
   * before it happens. The write itself is a PUT with the target date as the
   * id: the server writes the day, creates it when it is not there, and
   * refuses a date that is already past (apps/api/src/routes/menus.ts:200-216).
   */
  const handleCopy = async () => {
    if (!menu) return;
    if (!copyDate) {
      setActionError('Pick the day to fill with this one.');
      return;
    }
    if (copyDate === menu.date) {
      setActionError('That is the day you are looking at.');
      return;
    }
    setCopying(true);
    setActionError('');
    try {
      let existing: MenuDayRecord | null = null;
      try {
        const body = await queryJson<{ success: boolean; data: MenuDayRecord }>(
          `menus/${copyDate}`,
        );
        existing = body.data ?? null;
      } catch (err) {
        // The server answers 404 when the day carries no menu yet: that is the
        // normal case for a day the office wants to fill.
        if (err instanceof ApiQueryError && err.status === 404) existing = null;
        else throw err;
      }
      setCopyTarget(existing);
      setCopyOpen(true);
    } catch (err) {
      setActionError((await parseApiError(err)).message);
    } finally {
      setCopying(false);
    }
  };

  const confirmCopy = async () => {
    if (!menu || !copyDate) return;
    setCopying(true);
    setActionError('');
    try {
      await api
        .put(`menus/${copyDate}`, { json: { date: copyDate, meals: mealsPayload(menu) } })
        .json();
      setCopyOpen(false);
      setCopyResult(
        `The meals of ${longDate(menu.date)} are now the meals of ${longDate(copyDate)}. The server wrote an update entry in the audit log and told nobody: the residents read the day when they open the portal.`,
      );
      refresh();
    } catch (err) {
      setActionError((await parseApiError(err)).message);
      setCopyOpen(false);
    } finally {
      setCopying(false);
    }
  };

  if (!isLoading && (queryErrorMessage || !menu)) {
    return (
      <FormPage
        title="Day menu"
        description="The meals the kitchen planned for one day"
        backHref="/menus"
        error={queryErrorMessage || 'The server holds no menu for this day.'}
        maxWidth="full"
      />
    );
  }

  return (
    <FormPage
      title={menu ? longDate(menu.date) : 'Day menu'}
      description={
        menu
          ? 'The meals the kitchen planned for this day, and what the residents will read'
          : undefined
      }
      backHref="/menus"
      isLoading={isLoading}
      maxWidth="full"
      badge={
        menu ? (
          <StatusBadge
            variant={stateVariant}
            label={isPast ? `${stateLabel} - past` : stateLabel}
          />
        ) : undefined
      }
      actions={
        menu ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const phone = process.env.NEXT_PUBLIC_PG_PHONE ?? '';
                const formatItems = (items: MenuMealItem[]) =>
                  items.length === 0 ? 'Not set' : items.map((item) => item.name).join(', ');
                const text = [
                  `Menu for ${longDate(menu.date)}:`,
                  `Breakfast: ${formatItems(dishesOf(menu, 'breakfast'))}`,
                  `Lunch: ${formatItems(dishesOf(menu, 'lunch'))}`,
                  `Snacks: ${formatItems(dishesOf(menu, 'snacks'))}`,
                  `Dinner: ${formatItems(dishesOf(menu, 'dinner'))}`,
                ].join('\n');
                const url = generateWhatsAppUrl(phone, text);
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              title="Opens WhatsApp with the menu of this day. The server records nothing and nobody is told."
            >
              <MessageCircle className="h-4 w-4" />
              Share in WhatsApp
            </Button>
            {!isPast && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/menus/${menu._id}/edit`)}
              >
                <Pencil className="h-4 w-4" />
                Edit the day
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete the day
            </Button>
          </div>
        ) : undefined
      }
    >
      {menu && (
        <div className="space-y-4">
          {writeResult && (
            <div className="rounded-(--radius-lg) border border-(--color-success-200) bg-(--color-success-50) px-4 py-3 text-xs font-semibold text-(--color-success-800)">
              {writeResult}
            </div>
          )}

          {copyResult && (
            <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) px-4 py-3 text-xs font-semibold text-(--color-text-secondary)">
              {copyResult}
            </div>
          )}
          {actionError && (
            <div className="rounded-(--radius-lg) border border-(--color-danger-200) bg-(--color-danger-50) px-4 py-3 text-xs font-semibold text-(--color-danger-800)">
              {actionError}
            </div>
          )}

          {/* The protagonist of the page: the meals of this day. */}
          <DetailCard title="The meals of this day" icon={<ClipboardList />}>
            <div className="space-y-3">
              {MEAL_SLOTS.map(({ key, label, icon: Icon }) => {
                const dishes = dishesOf(menu, key);
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-1 border-b border-(--border-color) pb-3 last:border-0 last:pb-0 sm:flex-row sm:gap-4"
                  >
                    <div className="flex items-center gap-2 sm:w-40 sm:shrink-0">
                      <Icon className="h-4 w-4 shrink-0 text-(--color-text-muted)" />
                      <span className="text-xs font-bold text-(--color-text-primary)">{label}</span>
                    </div>
                    {dishes.length === 0 ? (
                      <p className="text-sm text-(--color-text-muted) italic">
                        Not set - the kitchen serves nothing in this slot for this day.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {dishes.map((dish, index) => (
                          <li key={`${key}-${index}`} className="text-sm">
                            <span className="font-semibold text-(--color-text-primary)">
                              {dish.name}
                            </span>
                            {dish.description && (
                              <span className="ml-1.5 text-xs text-(--color-text-secondary)">
                                {dish.description}
                              </span>
                            )}
                            {dish.category && (
                              <span className="text-2xs ml-1.5 font-semibold text-(--color-text-muted)">
                                {dish.category}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </DetailCard>

          {/* What the residents get, and what the server does not hold. */}
          <DetailCard title="What the residents read" icon={<CalendarDays />}>
            <div className="space-y-2 text-sm leading-relaxed text-(--color-text-secondary)">
              <p>
                The residents pull this menu. The portal reads GET /menus/today when a resident
                opens the app, so the plan reaches them on their next load. Nobody is told that the
                plan changed, and a day with no menu shows them nothing.
              </p>
              <p>
                Who ate: the server does not record it. A menu is a plan, not an attendance sheet,
                and there is no table of who ate what.
              </p>
              <p>
                What the residents said about the food is on the meals page. The share in WhatsApp
                opens a chat with the number of the office and the text of the day: the server
                records nothing about it, so that share leaves no trace on this page. The portal
                pull above is the only delivery the product keeps.
              </p>
              <Link
                href={`/meals?date=${menu.date}`}
                className="text-xs font-bold text-(--color-brand-600) hover:underline"
              >
                Open the feedback of {longDate(menu.date)}
              </Link>
              {isPast && (
                <p className="text-xs font-semibold text-(--color-warning-800)">
                  This day is past. The server refuses to edit it, so the plan can only be read.
                </p>
              )}
            </div>
          </DetailCard>

          {/* Fill another day with this one: the way a gap is closed. */}
          <DetailCard title="Fill another day with this one" icon={<Copy />}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <DatePicker
                label="The day to fill"
                aria-label="The day to fill with this menu"
                min={localTodayYmd()}
                value={copyDate}
                onChange={(val: string) => setCopyDate(val)}
              />
              <Button variant="outline" onClick={() => void handleCopy()} disabled={copying}>
                <Copy className="h-4 w-4" />
                Copy this day
              </Button>
            </div>
            <p className="text-2xs mt-2 font-medium text-(--color-text-muted)">
              The copy writes the four slots of this day onto the day you pick, creates it when it
              is not there yet, and refuses a date that is already past. It writes an update entry
              in the audit log and sends no message: the residents read the day when they open the
              portal.
            </p>
          </DetailCard>

          {/* The record itself. */}
          <DetailCard title="The record" icon={<Info />}>
            <DetailList>
              <DetailRow label="Date" value={menu.date} />
              <DetailRow label="State" value={stateLabel} />
              <DetailRow
                label="Slots with no dish"
                value={emptySlots === 0 ? 'none' : `${emptySlots} of 4`}
              />
              <DetailRow
                label="Dishes"
                value={MEAL_SLOTS.reduce(
                  (total, slot) => total + dishesOf(menu, slot.key).length,
                  0,
                )}
              />
              <DetailRow
                label="Planned"
                value={
                  menu.createdAt
                    ? new Date(menu.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'not reported'
                }
              />
              <DetailRow
                label="Last changed"
                value={
                  menu.updatedAt
                    ? new Date(menu.updatedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'not reported'
                }
              />
            </DetailList>
          </DetailCard>

          {/* The write trail. */}
          <DetailCard title="The write trail of this day" icon={<CalendarDays />}>
            {auditTrail && auditTrail.length > 0 ? (
              <Timeline
                events={auditTrail.map((entry) => {
                  const who = entry.userId?.name ? `by ${entry.userId.name}` : null;
                  const detailsDate =
                    entry.details && typeof entry.details['date'] === 'string'
                      ? String(entry.details['date'])
                      : null;
                  const title =
                    entry.action === 'create'
                      ? 'The day was planned'
                      : entry.action === 'update'
                        ? 'The day was changed'
                        : entry.action === 'delete'
                          ? 'The day was deleted'
                          : `The day was ${entry.action}`;
                  return {
                    id: entry._id,
                    date: entry.timestamp ?? '',
                    title,
                    description: [who, detailsDate ? `for ${detailsDate}` : null]
                      .filter((part): part is string => part !== null)
                      .join(' '),
                    status: entry.action === 'delete' ? 'danger' : 'info',
                  };
                })}
              />
            ) : (
              <p className="text-sm text-(--color-text-muted)">
                The server holds no write trail for this day yet. The entries it keeps expire after
                90 days.
              </p>
            )}
          </DetailCard>

          <p className="text-2xs flex items-start gap-1.5 font-medium text-(--color-text-muted)">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-warning-600)" />A
            menu is planned ahead and published by its date: there is no publish button and no draft
            state, because the model carries no status field. A day is either on the plan or it is
            not.
          </p>
        </div>
      )}

      <ConfirmModal
        open={deleteOpen}
        title="Delete the menu of this day"
        message={`The server deletes the menu of ${menu ? longDate(menu.date) : 'this day'} and writes a delete entry in the audit log. The residents who already read it are not told, and a resident who opens the portal on that day sees no menu at all.`}
        confirmLabel="Delete the day"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmModal
        open={copyOpen}
        variant="warning"
        title={`Fill ${copyDate ? longDate(copyDate) : 'the chosen day'} with this menu`}
        message={
          copyTarget
            ? `The server already holds a menu for ${longDate(copyTarget.date)}: ${copyTarget.meals?.breakfast?.length ?? 0} breakfast, ${copyTarget.meals?.lunch?.length ?? 0} lunch, ${copyTarget.meals?.snacks?.length ?? 0} snacks and ${copyTarget.meals?.dinner?.length ?? 0} dinner dishes. The copy overwrites every slot of that day, writes an update entry in the audit log, and sends no message.`
            : `The server holds no menu for ${copyDate ? longDate(copyDate) : 'that day'}. The copy writes the four slots of this day onto it, writes an update entry in the audit log, and sends no message.`
        }
        confirmLabel="Copy the meals"
        loading={copying}
        onConfirm={() => void confirmCopy()}
        onCancel={() => setCopyOpen(false)}
      />
    </FormPage>
  );
}
