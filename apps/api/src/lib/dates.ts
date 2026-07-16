/**
 * Timezone-aware date helpers for PG business logic.
 *
 * The product operates in India (IST). Server hosts (e.g. Render) run in UTC,
 * so `new Date().toISOString().slice(0, 10)` and `getHours()` drift from the
 * resident-facing calendar day: IST early morning resolves to the previous UTC
 * date and hour-window checks shift by 5.5 hours.
 *
 * All "business day" logic (attendance date, today's menu, check-in window,
 * dashboard day buckets) must use these helpers instead of raw UTC methods.
 */
import { env } from './env.js';

/** IANA timezone for PG operations. Configurable via PG_TIMEZONE env. */
export const PG_TIMEZONE = env.PG_TIMEZONE;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PG_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PG_TIMEZONE,
  hour: '2-digit',
  hour12: false,
});

const monthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PG_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
});

/** Returns the YYYY-MM-DD calendar date for the given instant in PG timezone. */
export function dateStringInTZ(date: Date = new Date()): string {
  // en-CA locale formats as YYYY-MM-DD
  return dateFormatter.format(date);
}

/** Returns today's YYYY-MM-DD in PG timezone. */
export function todayInTZ(): string {
  return dateStringInTZ(new Date());
}

/** Returns the current hour (0-23) in PG timezone. */
export function currentHourInTZ(): number {
  // en-GB hour12:false yields "00".."23"; Intl may emit "24" for midnight in
  // some engines, normalize to 0.
  const hour = Number(hourFormatter.format(new Date()));
  return hour === 24 ? 0 : hour;
}

/** Returns the YYYY-MM month string for the given instant in PG timezone. */
export function monthStringInTZ(date: Date = new Date()): string {
  return monthFormatter.format(date);
}

const offsetProbeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PG_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Millisecond offset of PG_TIMEZONE from UTC at the given instant. */
function tzOffsetMs(at: Date): number {
  const parts = offsetProbeFormatter.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hourRaw = get('hour');
  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hourRaw === 24 ? 0 : hourRaw,
    get('minute'),
    get('second'),
  );
  return asUTC - at.getTime();
}

/**
 * Interprets a wall-clock date + time in PG timezone and returns the Date instant.
 * `timeStr` accepts HH:mm or HH:mm:ss. Returns null on malformed input.
 */
export function makeDateInTZ(dateStr: string, timeStr: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr);
  if (!dateMatch || !timeMatch) return null;

  const utcGuess = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    Number(timeMatch[3] ?? 0),
  );
  // Adjust the naive-UTC guess by the zone offset at that instant. IST has no
  // DST so a single pass is exact; zones with DST are within one transition.
  const offset = tzOffsetMs(new Date(utcGuess));
  return new Date(utcGuess - offset);
}
