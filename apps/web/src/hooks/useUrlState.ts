'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface UrlStateOptions<T extends string> {
  /** The value that applies when the parameter is not in the address bar. */
  defaultValue: T;
  /** The values the parameter may take. A value outside this list reads as the default. */
  allowed?: readonly T[];
}

export interface UrlState<T extends string> {
  /** The current value, read from the address bar. */
  value: T;
  /** Writes a value into the address bar, keeping the other parameters. */
  setValue: (next: T) => void;
  /** Takes the parameter out of the address bar, so the default applies again. */
  reset: () => void;
}

export interface UrlStateWriter {
  /**
   * Applies every change in one navigation: a string sets the parameter, null takes it
   * out of the address bar. The parameters the page does not own are preserved.
   */
  write: (changes: Record<string, string | null>) => void;
}

export interface UrlSearchOptions {
  /** How long the text waits in the input before the address bar is written. */
  debounceMs?: number;
}

export interface UrlSearch {
  /** The text in the input: what the operator typed. */
  text: string;
  /** The committed text, as the address bar carries it. The list filters on this. */
  value: string;
  /** Called by the input on every keystroke. */
  onChange: (next: string) => void;
  /** Called when the operator clears the input. */
  clear: () => void;
  /** Drops a write that has not reached the address bar yet, without writing. */
  cancel: () => void;
}

/**
 * The read and write half that every hook in this file shares.
 *
 * A write is one navigation: the parameters that are not in `changes` are kept,
 * so a page owns its own parameters and not the whole address.
 */
function useUrlQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, next] of Object.entries(changes)) {
        if (next === null || next === '') params.delete(key);
        else params.set(key, next);
      }
      const query = params.toString();
      router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { searchParams, apply };
}

/**
 * Binds one piece of view state to the address bar.
 *
 * A filter, a tab, a sort or an open record lives in the URL, so a view can be linked, shared,
 * cited and reviewed, and every link that carries a query parameter lands filtered instead of on
 * an unfiltered list.
 *
 * The value is read with `useSearchParams` and written with `router.replace`, so changing it does
 * not push a history entry and does not scroll the page back to the top. The other query
 * parameters of the URL are preserved: this hook owns one parameter, not the whole address.
 *
 * Setting the default value takes the parameter out of the address bar, so "no filter" and
 * "the default filter" are the same link. A value that is not in `allowed` reads as the default:
 * a broken parameter never filters the list to nothing.
 *
 * Suspense: Next.js needs a Suspense boundary around a client component that reads
 * `useSearchParams`, because during a static prerender the router has no parameters to hand out.
 * The house pattern in this app is to split the page into a content component and a default
 * export that wraps it:
 *
 *     export default function PaymentsPage() {
 *       return (
 *         <Suspense fallback={<PageSkeleton />}>
 *           <PaymentsContent />
 *         </Suspense>
 *       );
 *     }
 *
 * The hook itself never throws and never reads the window during a render, so it does not break a
 * page that is not wrapped in a boundary: the value falls back to the default until the router
 * state arrives, and the page still renders.
 */
export function useUrlState<T extends string>(
  key: string,
  options: UrlStateOptions<T>,
): UrlState<T> {
  const { searchParams, apply } = useUrlQuery();
  const { defaultValue, allowed } = options;

  const raw = searchParams.get(key);

  const value = useMemo(() => {
    if (raw === null || raw === '') return defaultValue;
    if (allowed !== undefined && !allowed.includes(raw as T)) return defaultValue;
    return raw as T;
  }, [allowed, defaultValue, raw]);

  const write = useCallback(
    (next: T | null) => {
      apply({ [key]: next === null || next === defaultValue ? null : next });
    },
    [apply, defaultValue, key],
  );

  const setValue = useCallback(
    (next: T) => {
      if (next === value) return;
      write(next);
    },
    [value, write],
  );

  const reset = useCallback(() => {
    if (raw === null) return;
    write(null);
  }, [raw, write]);

  return { value, setValue, reset };
}

/**
 * Writes several parameters in one navigation.
 *
 * A page that clears its filters must not write them one by one: the second write would be built
 * on an address bar that does not carry the first one yet, and the first filter would come back.
 * One write, one address bar.
 */
export function useUrlStateWriter(): UrlStateWriter {
  const { apply } = useUrlQuery();
  return useMemo(() => ({ write: apply }), [apply]);
}

/**
 * Binds a text filter to the address bar.
 *
 * The input keeps its own text while the operator types, and the address bar carries the
 * committed text. The list filters on the committed text, so what the operator sees in the
 * address bar is what the list shows. The write waits for the typing to settle, so a search does
 * not fire one navigation per keystroke.
 */
export function useUrlSearch(key: string, options: UrlSearchOptions = {}): UrlSearch {
  const { debounceMs = 300 } = options;
  const state = useUrlState<string>(key, { defaultValue: '' });
  const [text, setText] = useState(state.value);
  // What the address bar carried the last time this hook wrote it.
  const committed = useRef(state.value);
  // True while the operator has typed something the address bar does not carry yet.
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeText = useRef<(next: string) => void>(() => undefined);

  // The address bar is the truth for the list. When it changes from outside (a shared
  // link, the back button, a reset) the draft follows it; a keystroke that has not
  // reached the address bar yet is never overwritten.
  useEffect(() => {
    if (state.value === text) {
      dirty.current = false;
      committed.current = state.value;
      return;
    }
    if (dirty.current) return;
    committed.current = state.value;
    setText(state.value);
  }, [state.value, text]);

  const write = useCallback(
    (next: string) => {
      committed.current = next;
      dirty.current = false;
      state.setValue(next);
    },
    [state],
  );
  // The latest write function, for the debounce timer. A ref must not be
  // written during render, so it is refreshed in an effect.
  useEffect(() => {
    writeText.current = write;
  }, [write]);

  const onChange = useCallback(
    (next: string) => {
      dirty.current = true;
      setText(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => writeText.current(next), debounceMs);
    },
    [debounceMs],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    setText('');
    writeText.current('');
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    setText(committed.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { text, value: state.value, onChange, clear, cancel };
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads a date range out of the address bar.
 *
 * `?date=` pins both ends (the deep link the dashboard sends). `fromDate` and `toDate` are read
 * on their own. A value that is not a date is ignored, so a broken parameter never filters the
 * list to nothing.
 */
export function readUrlDateRange(params: URLSearchParams): { fromDate: string; toDate: string } {
  const single = params.get('date');
  if (single !== null && YMD.test(single)) {
    return { fromDate: single, toDate: single };
  }
  const from = params.get('fromDate');
  const to = params.get('toDate');
  return {
    fromDate: from !== null && YMD.test(from) ? from : '',
    toDate: to !== null && YMD.test(to) ? to : '',
  };
}
