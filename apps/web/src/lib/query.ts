import type { Options as KyOptions } from 'ky';
import { api } from './api';
import { parseApiError } from './errorParser';

/**
 * Error thrown by the query helpers in this module.
 *
 * `message` is already user-facing because it comes from `parseApiError`, so
 * components can render it directly instead of parsing a thrown ky error in an
 * effect. `code` and `status` are kept for retry policy and diagnostics.
 */
export class ApiQueryError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'ApiQueryError';
    this.code = code;
    this.status = status;
  }
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: unknown }).response;
    if (response instanceof Response) return response.status;
  }
  return undefined;
}

/**
 * Retry policy for admin queries: one retry for network failures and 5xx, no
 * retry for 4xx (a 404 or 400 will not heal on a second attempt, and retrying
 * doubles the wait before the page can show its error state).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiQueryError && error.status !== undefined && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

/**
 * GET `path` and convert any failure into an `ApiQueryError` with a message
 * that is safe to show to an operator.
 */
export async function queryJson<T>(path: string, options?: KyOptions): Promise<T> {
  try {
    return await api.get(path, options).json<T>();
  } catch (error) {
    const parsed = await parseApiError(error);
    throw new ApiQueryError(parsed.message, parsed.code, statusOf(error));
  }
}

/**
 * `queryJson` plus unwrapping of the `{ success, data }` envelope that every
 * API route returns.
 */
export async function queryData<T>(path: string, options?: KyOptions): Promise<T> {
  const body = await queryJson<{ success: boolean; data: T }>(path, options);
  return body.data;
}

/** Read a query error as a display string; empty string when there is none. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}
