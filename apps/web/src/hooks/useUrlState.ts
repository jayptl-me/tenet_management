'use client';

import { useCallback, useMemo } from 'react';
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
 * "the default filter" are the same link.
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { defaultValue, allowed } = options;

  const raw = searchParams.get(key);

  const value = useMemo(() => {
    if (raw === null || raw === '') return defaultValue;
    if (allowed !== undefined && !allowed.includes(raw as T)) return defaultValue;
    return raw as T;
  }, [allowed, defaultValue, raw]);

  const write = useCallback((next: T | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null || next === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, next);
    }
    const query = params.toString();
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }, [defaultValue, key, pathname, router, searchParams]);

  const setValue = useCallback((next: T) => {
    if (next === value) return;
    write(next);
  }, [value, write]);

  const reset = useCallback(() => {
    if (raw === null) return;
    write(null);
  }, [raw, write]);

  return { value, setValue, reset };
}
