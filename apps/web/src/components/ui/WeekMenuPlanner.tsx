'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, CalendarDays, Sun, Sunset, Moon, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { surfaceCardClass } from '@/lib/field-styles';

interface MenuMealItem {
  name: string;
  description?: string;
  category?: string;
}

interface MenuDay {
  _id: string;
  date: string;
  meals: {
    breakfast: MenuMealItem[];
    lunch: MenuMealItem[];
    dinner: MenuMealItem[];
  };
  isActive: boolean;
}

interface WeekMenuPlannerProps {
  /** ISO week start (Monday, YYYY-MM-DD). Defaults to current week. */
  weekStart?: string;
  onDayClick?: (date: string) => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_SLOTS = [
  { key: 'breakfast' as const, icon: Sun },
  { key: 'lunch' as const, icon: Sunset },
  { key: 'dinner' as const, icon: Moon },
];

function getMondayOfWeek(ref?: Date): string {
  const d = ref ? new Date(ref) : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * 7-day grid (Mon-Sun) showing menu items per day.
 * Each cell summarises breakfast / lunch / dinner items.
 * Provides a "Copy day" action to duplicate one day's meals onto another day.
 */
export function WeekMenuPlanner({ weekStart, onDayClick }: WeekMenuPlannerProps) {
  const monday = useMemo(() => weekStart ?? getMondayOfWeek(), [weekStart]);
  const weekDates = useMemo(() => DAY_NAMES.map((_, i) => addDays(monday, i)), [monday]);

  const [menus, setMenus] = useState<Record<string, MenuDay | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [copySource, setCopySource] = useState<string | null>(null);
  const [copyTarget, setCopyTarget] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeek = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const fromDate = weekDates[0];
      const toDate = weekDates[6];
      const res = await api
        .get(`menus?fromDate=${fromDate}&toDate=${toDate}&limit=50`)
        .json<{ success: boolean; data: MenuDay[] }>();
      const map: Record<string, MenuDay | null> = {};
      for (const date of weekDates) map[date] = null;
      for (const menu of res.data ?? []) {
        if (menu.date) map[menu.date] = menu;
      }
      setMenus(map);
    } catch {
      setError('Failed to load weekly menus');
    } finally {
      setIsLoading(false);
    }
  }, [weekDates]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  const handleCopy = async (targetDate: string) => {
    if (!copySource || copySource === targetDate) return;
    setCopyTarget(targetDate);
    setCopyLoading(true);
    setError('');
    try {
      const sourceMenu = menus[copySource];
      const payload = {
        date: targetDate,
        meals: sourceMenu?.meals ?? { breakfast: [], lunch: [], dinner: [] },
      };
      const targetMenu = menus[targetDate];
      if (targetMenu?._id) {
        await api.put(`menus/${targetMenu._id}`, { json: payload }).json();
      } else {
        await api.post('menus', { json: payload }).json();
      }
      setCopySource(null);
      setCopyTarget(null);
      await fetchWeek();
    } catch {
      setError('Failed to copy day menu');
      setCopyTarget(null);
    } finally {
      setCopyLoading(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className={clsx(surfaceCardClass, 'p-5')}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
          <h3 className="font-[family:var(--font-display)] text-base font-bold text-[color:var(--color-text-primary)]">
            Week of {formatDayLabel(monday)}
          </h3>
        </div>
        {copySource && (
          <span className="text-xs font-semibold text-[color:var(--color-brand-600)]">
            Select a target day to copy {formatDayLabel(copySource)}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 text-[12px] font-medium text-[color:var(--color-danger-600)]" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {weekDates.map((date, idx) => {
          const menu = menus[date];
          const isToday = date === todayStr;
          const isCopySource = copySource === date;

          return (
            <div
              key={date}
              className={clsx(
                'rounded-[var(--radius-lg)] border p-3 transition-colors',
                isCopySource
                  ? 'border-[color:var(--color-brand-400)] bg-[color:var(--color-brand-50)]'
                  : isToday
                    ? 'border-[color:var(--color-success-300)] bg-[color:var(--color-success-50)]'
                    : 'border-[color:var(--border-color)] bg-[color:var(--color-field-bg)]',
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                    {DAY_NAMES[idx]}
                  </p>
                  <p className="font-[family:var(--font-display)] text-sm font-bold text-[color:var(--color-text-primary)]">
                    {formatDayLabel(date)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCopySource(copySource === date ? null : date)}
                  aria-pressed={isCopySource}
                  aria-label={`Select ${formatDayLabel(date)} as copy source`}
                  className={clsx(
                    'rounded-[var(--radius-md)] border p-1 transition-colors',
                    isCopySource
                      ? 'border-[color:var(--color-brand-400)] text-[color:var(--color-brand-600)]'
                      : 'border-[color:var(--border-color)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]',
                  )}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {MEAL_SLOTS.map(({ key, icon: Icon }) => {
                  const items = menu?.meals?.[key] ?? [];
                  return (
                    <div key={key} className="flex items-start gap-1.5">
                      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-text-muted)]" />
                      <div className="min-w-0 flex-1">
                        {items.length === 0 ? (
                          <p className="text-[11px] italic text-[color:var(--color-text-muted)]">
                            Not set
                          </p>
                        ) : (
                          <p className="truncate text-[11px] font-medium text-[color:var(--color-text-secondary)]">
                            {items.map((i) => i.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center gap-2">
                {copySource && copySource !== date ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(date)}
                    disabled={copyLoading && copyTarget === date}
                    className="text-[11px] font-semibold text-[color:var(--color-brand-600)] hover:underline disabled:opacity-50"
                  >
                    {copyLoading && copyTarget === date ? 'Copying...' : 'Paste here'}
                  </button>
                ) : (
                  onDayClick && (
                    <button
                      type="button"
                      onClick={() => onDayClick(date)}
                      className="text-[11px] font-semibold text-[color:var(--color-brand-600)] hover:underline"
                    >
                      {menu ? 'View' : 'Create'}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[color:var(--color-text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading weekly menus...
        </div>
      )}
    </div>
  );
}

