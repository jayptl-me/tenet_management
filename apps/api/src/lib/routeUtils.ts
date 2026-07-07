import type { Context } from 'hono';
import type { Model } from 'mongoose';

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
/** Cast a plain filter object for use with Mongoose 9 strict-typed queries.
 *  Use only when filters contain ObjectId-like string values (e.g. userId, roomId). */
export function safeFilter<T extends Record<string, unknown>>(filter: T): Record<string, unknown> {
  return filter as Record<string, unknown>;
}

// ── Error Helpers ───────────────────────────────────────
export function notFound(c: Context, resource: string) {
  return c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: `${resource} not found` },
    },
    404,
  );
}

export function badRequest(c: Context, message: string, code = 'BAD_REQUEST') {
  return c.json(
    {
      success: false,
      error: { code, message },
    },
    400,
  );
}

export function conflict(c: Context, message: string, code = 'CONFLICT') {
  return c.json(
    {
      success: false,
      error: { code, message },
    },
    409,
  );
}

export function featureDisabled(c: Context, feature: string) {
  return c.json(
    {
      success: false,
      error: { code: 'FEATURE_DISABLED', message: `${feature} is not enabled.` },
    },
    404,
  );
}

/** Thrown by services — caught by globalErrorHandler and converted to JSON */
export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = 'APP_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}
