'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cookie,
  Download,
  Info,
  Moon,
  Plus,
  Search,
  Sun,
  Sunset,
  TriangleAlert,
} from 'lucide-react';
import { clsx } from 'clsx';
import { errorMessage } from '@/lib/query';
import { useApiBodyQuery } from '@/hooks/useApiQuery';
import { useUrlSearch, useUrlState, useUrlStateWriter } from '@/hooks/useUrlState';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FilterChips } from '@/components/ui/FilterChips';
import { Input } from '@/components/ui/Input';
import { PageBand } from '@/components/ui/PageBand';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusTabs } from '@/components/ui/StatusTabs';

// ── Shapes ─────────────────────────────────────────────────────────────
// Every field below is read out of the API response, never invented:
//   GET /menus        apps/api/src/routes/menus.ts:52-125
//   GET /menus/:id    apps/api/src/routes/menus.ts:169-177
// The menu model carries no status field (apps/api/src/models/dailyMenu.ts):
// a day is planned or it is not, and the date decides whether it is past.

/** One dish of one slot. */
interface MenuMealItem {
  name: string;
  description?: string;
  category?: string;
}

/** One day of the plan, as the server sends it. */
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
}

interface MenusListBody {
  success: boolean;
  data: MenuDayRecord[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

// Stable empty fallback: `?? []` would allocate a fresh array on every render
// while the query is pending, breaking referential stability for useMemo deps.
const EMPTY_MENUS: MenuDayRecord[] = [];

// ── The four slots of a day ────────────────────────────────────────────

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: Sun },
  { key: 'lunch', label: 'Lunch', icon: Sunset },
  { key: 'snacks', label: 'Snacks', icon: Cookie },
  { key: 'dinner', label: 'Dinner', icon: Moon },
] as const;

type SlotKey = (typeof MEAL_SLOTS)[number]['key'];

/** The values the status filter may take in the address bar. */
const STATUS_FILTERS = ['all', 'upcoming', 'past'] as const;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * The business day of the office.
 *
 * The server keeps the business day in the PG timezone (Asia/Kolkata by
 * default, apps/api/src/lib/env.ts:51) and refuses a menu for a date that is
 * already past (apps/api/src/routes/menus.ts:132-140). The office reads the
 * same calendar day, so the two agree; if they ever did not, the server's
 * refusal is what the operator sees.
 */
function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** The calendar date of a Date, in the browser's own timezone. */
function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The same date, days later. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalYmd(d);
}

/** The Monday of the week a date belongs to. */
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = d.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + diff);
  return toLocalYmd(d);
}

/** The seven dates of the week that starts on the given Monday. */
function weekDatesOf(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** "19 Oct" of a date, without the year. */
function shortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

/** "19 Oct 2026" of a date. */
function longDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** The weekday of a date, "Monday". */
function weekdayOf(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
}

// ── The shape of one day in the planner ────────────────────────────────

interface DayView {
  date: string;
  /** The menu the server holds for the day, when it holds one. */
  menu: MenuDayRecord | null;
  isToday: boolean;
  isPast: boolean;
  /** The dishes of each slot, empty when the slot holds none. */
  items: Record<SlotKey, MenuMealItem[]>;
  /** How many of the four slots hold no dish. */
  emptySlots: number;
  /** How many dishes the day carries. */
  dishes: number;
  /** The badge the day wears. */
  label: string;
  variant: 'success' | 'warning' | 'neutral';
}

/** Builds the day the grid draws, from the menu the server holds (or not). */
function toDayView(date: string, menu: MenuDayRecord | null, today: string): DayView {
  const items = {
    breakfast: menu?.meals?.breakfast ?? [],
    lunch: menu?.meals?.lunch ?? [],
    snacks: menu?.meals?.snacks ?? [],
    dinner: menu?.meals?.dinner ?? [],
  };
  const emptySlots = MEAL_SLOTS.filter((slot) => items[slot.key].length === 0).length;
  const dishes = MEAL_SLOTS.reduce((total, slot) => total + items[slot.key].length, 0);
  const isPast = date < today;

  let label = 'Not planned';
  let variant: DayView['variant'] = 'neutral';
  if (menu) {
    if (emptySlots === 0) {
      label = 'Planned';
      variant = 'success';
    } else {
      label = 'Partly planned';
      variant = 'warning';
    }
  }

  return {
    date,
    menu,
    isToday: date === today,
    isPast,
    items,
    emptySlots,
    dishes,
    label,
    variant,
  };
}

// ── The cell of the week grid ──────────────────────────────────────────

/**
 * One day of the week.
 *
 * The cell is the module's protagonist: the day, what the kitchen serves on
 * it, and the one thing the office can do with it. A day that carries a menu
 * links to the day itself (the meals on it); a day that carries none links to
 * the form with that date already filled in, so the gap is closed from where
 * the operator stands.
 */
function DayCell({ day }: { day: DayView }) {
  return (
    <div
      className={clsx(
        // The card chrome is written out here and not taken from surfaceCardClass, because the
        // cell of today carries its own border and its own surface and two border colours in
        // one class list do not have a winner.
        'flex flex-col gap-2.5 rounded-(--radius-xl) border border-[length:var(--bw-default)] p-3 shadow-(--shadow-card)',
        day.isToday
          ? 'border-(--color-brand-400) bg-(--color-brand-50)'
          : 'border-(--border-color) bg-(--color-card-bg)',
        day.isPast && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xs tracking-label font-semibold text-(--color-text-muted) uppercase">
            {weekdayOf(day.date)}
          </p>
          <p className="font-display text-sm font-bold text-(--color-text-primary)">
            {shortDate(day.date)}
          </p>
        </div>
        {day.isToday && (
          <span className="text-2xs rounded-(--radius-full) bg-(--color-brand-100) px-2 py-0.5 font-bold text-(--color-brand-800)">
            Today
          </span>
        )}
      </div>

      <StatusBadge variant={day.variant} label={day.label} size="xs" />

      <ul className="space-y-1.5">
        {MEAL_SLOTS.map(({ key, label: slotLabel, icon: Icon }) => {
          const dishes = day.items[key];
          return (
            <li key={key} className="flex items-start gap-1.5">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" />
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-semibold text-(--color-text-muted)">{slotLabel}</p>
                {dishes.length === 0 ? (
                  <p className="text-2xs text-(--color-text-muted) italic">Not set</p>
                ) : (
                  <p className="text-xs font-medium text-(--color-text-secondary)">
                    {dishes.map((dish) => dish.name).join(', ')}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-1">
        {day.menu ? (
          <Link
            href={`/menus/${day.menu._id}`}
            className="text-xs font-bold text-(--color-brand-600) hover:underline"
          >
            Open the day
          </Link>
        ) : day.isPast ? (
          <p className="text-2xs font-medium text-(--color-text-muted)">
            The server refuses a menu for a past date.
          </p>
        ) : (
          <Link
            href={`/menus/new?date=${day.date}`}
            className="text-xs font-bold text-(--color-brand-600) hover:underline"
          >
            Plan this day
          </Link>
        )}
      </div>
    </div>
  );
}

// ── The page ───────────────────────────────────────────────────────────

function MenusContent() {
  const router = useRouter();
  const { write: writeUrl } = useUrlStateWriter();

  // The filters live in the address bar: a week of the plan can be linked,
  // cited and reviewed, and a link that carries a query parameter lands on
  // the same view the sender was looking at.
  const weekState = useUrlState<string>('week', { defaultValue: '' });
  const statusState = useUrlState<string>('status', {
    defaultValue: 'all',
    allowed: STATUS_FILTERS,
  });
  const searchState = useUrlSearch('search');

  const today = localTodayYmd();
  const weekParam = weekState.value;
  const search = searchState.value.trim();
  const statusFilter = statusState.value;

  const weekStart = useMemo(
    () => mondayOf(isValidYmd(weekParam) ? weekParam : today),
    [weekParam, today],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDates = useMemo(() => weekDatesOf(weekStart), [weekStart]);

  /**
   * The week in view.
   *
   * The server answers with the days it holds, sorted by the date, so the
   * grid reads Monday to Sunday without the client sorting anything.
   */
  const {
    data: weekBody,
    isPending: isLoading,
    error: weekError,
  } = useApiBodyQuery<MenusListBody>(
    ['menus', 'week', weekStart, weekEnd],
    `menus?fromDate=${weekStart}&toDate=${weekEnd}&sort=date&order=asc&limit=50`,
  );

  /**
   * The days the search matches, over the whole set of menus.
   *
   * The server matches a dish name across the four slots, or an exact date
   * (apps/api/src/routes/menus.ts:83-99). The answer is not scoped to the
   * week, so the page can say where else the dish was served.
   */
  const {
    data: searchBody,
    isPending: isSearchLoading,
    error: searchError,
  } = useApiBodyQuery<MenusListBody>(
    ['menus', 'search', search],
    `menus?search=${encodeURIComponent(search)}&sort=date&order=desc&limit=50`,
    { enabled: search !== '' },
  );

  /**
   * How many menus the server holds in all.
   *
   * One row is enough: the answer is the count the server reports, and it
   * tells the page whether the office has ever planned anything.
   */
  const { data: countBody } = useApiBodyQuery<MenusListBody>(['menus', 'count'], 'menus?limit=1', {
    staleTime: 15_000,
  });
  const totalMenus = countBody?.meta?.total ?? 0;

  const weekMenus = weekBody?.data ?? EMPTY_MENUS;
  const searchMenus = searchBody?.data ?? EMPTY_MENUS;

  const menusByDate = useMemo(() => {
    const map = new Map<string, MenuDayRecord>();
    for (const menu of weekMenus) map.set(menu.date, menu);
    return map;
  }, [weekMenus]);

  const searchDates = useMemo(() => {
    const set = new Set<string>();
    for (const menu of searchMenus) set.add(menu.date);
    return set;
  }, [searchMenus]);

  /**
   * The days the grid draws.
   *
   * A search narrows the week to the days that match it; the status filter
   * narrows it to the days that are still ahead or the days that are gone.
   * The filter is the screen's own: the server has no "days with a gap"
   * filter, so the legend says what the filter does.
   */
  const gridDays = useMemo(() => {
    return weekDates
      .filter((date) => {
        if (statusFilter === 'upcoming') return date >= today;
        if (statusFilter === 'past') return date < today;
        return true;
      })
      .filter((date) => (search === '' ? true : searchDates.has(date)))
      .map((date) => toDayView(date, menusByDate.get(date) ?? null, today));
  }, [weekDates, statusFilter, today, search, searchDates, menusByDate]);

  /** The days outside the week in view that the search matched. */
  const otherMatches = useMemo(
    () => searchMenus.filter((menu) => menu.date < weekStart || menu.date > weekEnd),
    [searchMenus, weekStart, weekEnd],
  );

  /** The numbers of the band, over the days the grid shows. */
  const daysToPlan = gridDays.filter((day) => day.menu === null).length;
  const slotsToFill = gridDays.reduce((total, day) => total + day.emptySlots, 0);
  const dishesOnBoard = gridDays.reduce((total, day) => total + day.dishes, 0);

  /** The first day of the week that the server still accepts a menu for. */
  const firstPlannable = useMemo(() => {
    const candidate = weekDates.find((date) => date >= today);
    return candidate ?? today;
  }, [weekDates, today]);

  const goToWeek = (monday: string) => writeUrl({ week: monday });

  const clearAllFilters = () => {
    writeUrl({ week: null, status: null, search: null });
  };

  const chips = [
    ...(weekParam
      ? [
          {
            key: 'week',
            label: 'Week',
            value: `from ${shortDate(weekStart)}`,
            onRemove: () => weekState.reset(),
          },
        ]
      : []),
    ...(statusFilter !== 'all'
      ? [
          {
            key: 'status',
            label: 'Days',
            value: statusFilter === 'upcoming' ? 'Today and ahead' : 'Past',
            onRemove: () => statusState.reset(),
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: 'search',
            label: 'Search',
            value: search,
            onRemove: () => searchState.clear(),
          },
        ]
      : []),
  ];

  /**
   * The export of the week in view.
   *
   * It writes the days the grid shows, so the file and the screen carry the
   * same days. The server holds one menu per date (the date is unique), so
   * there is nothing to page through: the week is the whole set.
   */
  const handleExportCsv = () => {
    if (gridDays.length === 0) return;
    const escapeCsv = (val: unknown) => {
      let str = String(val ?? '');
      if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
      return `"${str.replace(/"/g, '""')}"`;
    };
    const headers = ['Date', 'Day', 'State', 'Breakfast', 'Lunch', 'Snacks', 'Dinner', 'Dishes'];
    const rows = gridDays.map((day) => [
      escapeCsv(day.date),
      escapeCsv(weekdayOf(day.date)),
      escapeCsv(day.label),
      escapeCsv(day.items.breakfast.map((dish) => dish.name).join('; ')),
      escapeCsv(day.items.lunch.map((dish) => dish.name).join('; ')),
      escapeCsv(day.items.snacks.map((dish) => dish.name).join('; ')),
      escapeCsv(day.items.dinner.map((dish) => dish.name).join('; ')),
      escapeCsv(day.dishes),
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `menus-week-${weekStart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // While the week is on its way the page must not claim the week is empty.
  const nothingPlannedYet =
    !isLoading && totalMenus === 0 && weekMenus.length === 0 && search === '';
  const weekHasNoMenu = !isLoading && weekMenus.length === 0 && search === '';
  const gridIsEmpty = gridDays.length === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Menus"
        description="What the residents eat this week, and the days that are still missing"
        action={
          <Button onClick={() => router.push('/menus/new')}>
            <Plus className="h-4 w-4" />
            Plan a day
          </Button>
        }
      />

      <ErrorBanner message={errorMessage(weekError) || errorMessage(searchError)} />

      <PageBand
        metrics={[
          {
            label: 'Days in view',
            value: String(gridDays.length),
            hint: `of the ${weekDates.length} days of the week of ${shortDate(weekStart)}`,
            tone: 'brand',
          },
          {
            label: 'Days to plan',
            value: String(daysToPlan),
            hint: 'the server holds no menu for these days',
            tone: daysToPlan > 0 ? 'warning' : 'success',
          },
          {
            label: 'Slots to fill',
            value: String(slotsToFill),
            hint: 'a meal slot of a planned day that holds no dish',
            tone: slotsToFill > 0 ? 'warning' : 'success',
          },
          {
            label: 'Dishes on the board',
            value: String(dishesOnBoard),
            hint: 'every dish of the days in view',
            tone: 'default',
          },
        ]}
      >
        <StatusTabs
          tabs={[
            { key: 'all', label: 'All days', count: weekDates.length, tone: 'brand' },
            {
              key: 'upcoming',
              label: 'Today and ahead',
              count: weekDates.filter((date) => date >= today).length,
              tone: 'success',
            },
            {
              key: 'past',
              label: 'Past',
              count: weekDates.filter((date) => date < today).length,
              tone: 'default',
            },
          ]}
          active={statusFilter}
          onChange={(key) => statusState.setValue(key)}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-label="The week before"
              onClick={() => goToWeek(addDays(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold text-(--color-text-secondary)">
              Week of {shortDate(weekStart)}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="The week after"
              onClick={() => goToWeek(addDays(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {weekParam && (
              <Button variant="ghost" size="sm" onClick={() => weekState.reset()}>
                This week
              </Button>
            )}
          </div>

          <div className="max-w-sm sm:w-72">
            <Input
              placeholder="Search a dish or a date..."
              aria-label="Search a dish or a date across every menu"
              value={searchState.text}
              onChange={(e) => searchState.onChange(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={gridDays.length === 0}
            title="Write the days of this week to a CSV file"
          >
            <Download className="h-4 w-4" />
            Export the week
          </Button>

          <FilterChips chips={chips} onClearAll={clearAllFilters} />
        </div>
      </PageBand>

      {isLoading ? (
        <p className="text-sm font-medium text-(--color-text-muted)">
          The server is loading the week of {shortDate(weekStart)}...
        </p>
      ) : nothingPlannedYet ? (
        <EmptyState
          icon={<ClipboardList className="h-10 w-10" />}
          title="No menu is planned yet"
          description={`The residents read the menu of the day from the portal, so a day with no menu shows them nothing. The kitchen serves breakfast, lunch and dinner, and snacks when there is one. The server refuses a date that is already past, so the first day it still takes is ${longDate(firstPlannable)}.`}
          action={{
            label: `Plan ${longDate(firstPlannable)}`,
            onClick: () => router.push(`/menus/new?date=${firstPlannable}`),
          }}
        />
      ) : weekHasNoMenu ? (
        <>
          <div className="rounded-(--radius-lg) border border-(--color-warning-200) bg-(--color-warning-50) px-4 py-3 text-xs font-semibold text-(--color-warning-800)">
            {`No menu is planned for the week of ${shortDate(weekStart)}. The residents read the menu of the day from the portal, so these days show them nothing. The first day the server still takes is ${longDate(firstPlannable)}.`}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {gridDays.map((day) => (
              <DayCell key={day.date} day={day} />
            ))}
          </div>
          <p className="text-2xs font-medium text-(--color-text-muted)">
            {gridDays.length} of {weekDates.length} days in view
          </p>
        </>
      ) : gridIsEmpty ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title={
            search !== ''
              ? `No day of this week matches "${search}"`
              : 'No day of this week is in the filter'
          }
          description={
            search !== ''
              ? 'The search runs across every menu the server holds, so the dish may be served on another week. The days it matched outside this week are listed below.'
              : 'The filter hides every day of this week. Clear it to see the week again.'
          }
          action={{
            label: search !== '' ? 'Clear the search' : 'Clear the filters',
            onClick: () => (search !== '' ? searchState.clear() : clearAllFilters()),
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {gridDays.map((day) => (
              <DayCell key={day.date} day={day} />
            ))}
          </div>

          <p className="text-2xs font-medium text-(--color-text-muted)">
            {gridDays.length} of {weekDates.length} days in view
          </p>
        </>
      )}

      {search !== '' && (isSearchLoading || otherMatches.length > 0) && (
        <div className="rounded-(--radius-lg) border border-(--border-color) bg-(--color-card-bg) p-4">
          <p className="text-xs font-bold text-(--color-text-primary)">
            {isSearchLoading
              ? 'The server is looking for the days that match...'
              : `${otherMatches.length} other day${otherMatches.length === 1 ? '' : 's'} serve "${search}"`}
          </p>
          {!isSearchLoading && otherMatches.length > 0 && (
            <>
              <p className="text-2xs mt-1 font-medium text-(--color-text-secondary)">
                Outside the week in view. Open a day for its meals, or the week it belongs to.
              </p>
              <ul className="mt-2 flex flex-wrap items-center gap-2">
                {otherMatches.map((menu) => (
                  <li key={menu._id}>
                    <span className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/menus/${menu._id}`}
                        className="text-xs font-bold text-(--color-brand-600) hover:underline"
                      >
                        {shortDate(menu.date)}
                      </Link>
                      <button
                        type="button"
                        onClick={() => goToWeek(mondayOf(menu.date))}
                        className="text-2xs font-semibold text-(--color-text-secondary) underline-offset-2 hover:underline"
                      >
                        its week
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* What the numbers and the states mean. A number nobody can place is a
          number nobody trusts. */}
      <div className="text-2xs space-y-1 font-medium text-(--color-text-muted)">
        <p>
          <Info className="mr-1 inline h-3 w-3" />
          Every number in the band counts the days the grid shows. The days in view, the days to
          plan, the slots to fill and the dishes on the board all describe the same days, so the
          band and the grid never disagree.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Planned</strong> means the day carries a
          menu and every one of the four slots holds a dish.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Partly planned</strong> means the day
          carries a menu with a slot still empty.
        </p>
        <p>
          <strong className="text-(--color-text-secondary)">Not planned</strong> means the server
          holds no menu for that date.
        </p>
        <p>
          The residents are not told when a menu changes. The portal reads GET /menus/today when a
          resident opens the app, so a menu reaches them on their next load, and a day with no menu
          shows them nothing.
        </p>
        <p>
          <TriangleAlert className="mr-1 inline h-3 w-3" />
          The search runs across every menu the server holds, so a dish served in another week is
          found there. The days and the status filter live in the address bar, so this view is a
          link.
        </p>
      </div>
    </div>
  );
}

export default function MenusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[length:var(--bw-strong)] border-(--border-color) border-t-(--color-brand-500)" />
        </div>
      }
    >
      <MenusContent />
    </Suspense>
  );
}
