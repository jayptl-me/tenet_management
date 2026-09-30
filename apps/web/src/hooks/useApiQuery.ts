'use client';

import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { queryData, queryJson, type ApiQueryError } from '@/lib/query';

type ApiQueryOptions<T> = Omit<
  UseQueryOptions<T, ApiQueryError, T, QueryKey>,
  'queryKey' | 'queryFn'
>;

/**
 * Drop-in replacement for the `useEffect` + `isLoading` + `setError` fetch
 * block that most admin pages used to hand-roll.
 *
 * The query key is the cache identity: include every value that changes the
 * response (route params, page, search, filters) so a change refetches, and
 * keep it stable otherwise so React Query can paint the previous payload while
 * the refetch runs.
 *
 * Errors are `ApiQueryError`, whose `.message` is already display-ready - read
 * it with `errorMessage(error)` rather than parsing the failure again.
 *
 * Unwraps the `{ success, data }` envelope that every API route returns, so
 * `data` is the payload itself. Use `useApiBodyQuery` when the response also
 * carries siblings of `data` such as `total`.
 */
export function useApiQuery<T>(
  queryKey: QueryKey,
  path: string,
  options?: ApiQueryOptions<T>,
): UseQueryResult<T, ApiQueryError> {
  return useQuery<T, ApiQueryError>({
    queryKey,
    queryFn: () => queryData<T>(path),
    ...options,
  });
}

/** Same as `useApiQuery` but resolves to the whole response body. */
export function useApiBodyQuery<T>(
  queryKey: QueryKey,
  path: string,
  options?: ApiQueryOptions<T>,
): UseQueryResult<T, ApiQueryError> {
  return useQuery<T, ApiQueryError>({
    queryKey,
    queryFn: () => queryJson<T>(path),
    ...options,
  });
}
