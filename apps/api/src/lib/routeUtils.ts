import type { Context } from 'hono';
import type { Model } from 'mongoose';
import {
  ResourceNotFoundError,
  ValidationError,
  ConflictError,
  FeatureDisabledError,
} from './errors.js';

// ── Re-export AppError for backward compatibility with existing route files ──
export { AppError } from './errors.js';

// ── Pagination Parser ───────────────────────────────────
export function parsePagination(c: Context) {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const sort = c.req.query('sort') || 'createdAt';
  const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';

  return { page, limit, sort, order, skip: (page - 1) * limit };
}

// ── Paginated Response Builder ──────────────────────────
export async function paginatedResponse<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  pagination: ReturnType<typeof parsePagination>,
  populate?: string | string[],
): Promise<{
  data: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    model
      .find(filter)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate(populate ?? [])
      .lean(),
    model.countDocuments(filter),
  ]);

  return {
    data: data as Record<string, unknown>[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Safe ObjectId Parser ────────────────────────────────
export function parseId(id: string): string | null {
  return /^[a-f\d]{24}$/i.test(id) ? id : null;
}

// ── Mongoose 9 Filter Helper ────────────────────────────
/** Cast a plain filter object for use with Mongoose 9 strict-typed queries. */
export function safeFilter<T extends Record<string, unknown>>(filter: T): Record<string, unknown> {
  return filter as Record<string, unknown>;
}

// ── Error Helpers (use new error classes for better UX) ─
export function notFound(c: Context, resource: string) {
  throw new ResourceNotFoundError(resource);
}

export function badRequest(c: Context, message: string, code = 'BAD_REQUEST') {
  throw new ValidationError(message);
}

export function conflict(c: Context, message: string, code = 'CONFLICT') {
  throw new ConflictError(message);
}

export function featureDisabled(c: Context, feature: string) {
  throw new FeatureDisabledError(feature);
}
