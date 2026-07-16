import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, parsePagination, conflict } from '../lib/routeUtils.js';
import { DailyMenu } from '../models/dailyMenu.js';
import { todayInTZ } from '../lib/dates.js';

const menus = new Hono();

// ── Schemas ─────────────────────────────────────────────
const menuMealItemSchema = z.strictObject({
  name: z.string().min(1, 'Item name is required').max(100).trim(),
  description: z.string().max(300).trim().optional(),
  category: z.string().max(50).trim().optional(),
});

const menuDaySchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  meals: z.strictObject({
    breakfast: z.array(menuMealItemSchema).optional().default([]),
    lunch: z.array(menuMealItemSchema).optional().default([]),
    dinner: z.array(menuMealItemSchema).optional().default([]),
  }),
});

function withMenuFlags<T extends { date?: string }>(menu: T) {
  const today = todayInTZ();
  const date = menu.date ?? '';
  return {
    ...menu,
    // Derived for FE badges: future/today menus are "active"
    isActive: date >= today,
  };
}

// ── GET /menus/today ────────────────────────────────────
menus.get('/today', authGuard, async (c) => {
  const today = todayInTZ();
  const menu = await DailyMenu.findOne({ date: today }).lean();
  if (!menu) return notFound(c, "Today's menu");
  return c.json({ success: true, data: withMenuFlags(menu as { date?: string }) });
});

// ── GET /menus ──────────────────────────────────────────
menus.get('/', authGuard, async (c) => {
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const isActive = c.req.query('isActive');
  const search = c.req.query('search');

  const filter: Record<string, unknown> = {};
  if (fromDate || toDate) {
    const dateFilter: Record<string, string> = {};
    if (fromDate) dateFilter.$gte = fromDate;
    if (toDate) dateFilter.$lte = toDate;
    filter.date = dateFilter;
  }
  // isActive is derived from date vs today (no schema field). Use PG timezone.
  if (isActive !== undefined && isActive !== '') {
    const today = todayInTZ();
    const existing = (filter.date as Record<string, string> | undefined) ?? {};
    if (isActive === 'true') {
      filter.date = { ...existing, $gte: existing.$gte && existing.$gte > today ? existing.$gte : today };
    } else {
      filter.date = { ...existing, $lt: existing.$lt && existing.$lt < today ? existing.$lt : today };
    }
  }
  // Support partial date search from frontend
  if (search) {
    const parsed = Date.parse(search);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      const dateStr = d.toISOString().slice(0, 10);
      filter.date = dateStr;
    }
  }

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [raw, total] = await Promise.all([
    DailyMenu.find(filter)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .lean(),
    DailyMenu.countDocuments(filter),
  ]);

  const data = (raw as { date?: string }[]).map((m) => withMenuFlags(m));

  return c.json({
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── POST /menus ─────────────────────────────────────────
menus.post('/', authGuard, adminOnly, zValidator('json', menuDaySchema), async (c) => {
  const body = c.req.valid('json');
  const today = todayInTZ();

  if (body.date < today) {
    return c.json(
      {
        success: false,
        error: { code: 'PAST_DATE', message: 'Cannot create menus for past dates.' },
      },
      422,
    );
  }

  try {
    const menu = await DailyMenu.create(body);
    return c.json({ success: true, data: withMenuFlags(menu.toObject()) }, 201);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      return conflict(c, 'A menu for this date already exists', 'DUPLICATE_MENU');
    }
    throw err;
  }
});

// ── GET /menus/:id ──────────────────────────────────────────
menus.get('/:id', authGuard, async (c) => {
  const id = c.req.param('id');
  // Support date-string lookup as well as ObjectId
  const menu = /^\d{4}-\d{2}-\d{2}$/.test(id)
    ? await DailyMenu.findOne({ date: id }).lean()
    : await DailyMenu.findById(id).lean();
  if (!menu) return notFound(c, 'Daily menu');
  return c.json({ success: true, data: withMenuFlags(menu as { date?: string }) });
});

// ── PUT /menus/:id ──────────────────────────────────────
menus.put('/:id', authGuard, adminOnly, zValidator('json', menuDaySchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  // Reject edits to past dates
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(id) ? id : body.date;
  const today = todayInTZ();
  if (targetDate && targetDate < today) {
    return c.json(
      {
        success: false,
        error: { code: 'PAST_DATE', message: 'Cannot edit menus for past dates.' },
      },
      422,
    );
  }

  try {
    // If param looks like a date (YYYY-MM-DD), upsert by date; otherwise find by ObjectId
    if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
      const menu = await DailyMenu.findOneAndUpdate(
        { date: id },
        { ...body, date: id },
        { upsert: true, returnDocument: 'after', runValidators: true },
      ).lean();
      return c.json({ success: true, data: withMenuFlags(menu as { date?: string }) });
    }

    const menu = await DailyMenu.findByIdAndUpdate(id, body, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();
    if (!menu) return notFound(c, 'Daily menu');
    return c.json({ success: true, data: withMenuFlags(menu as { date?: string }) });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      return conflict(c, 'A menu for this date already exists', 'DUPLICATE_MENU');
    }
    throw err;
  }
});

// ── DELETE /menus/:id ───────────────────────────────────
menus.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = c.req.param('id');

  // If param looks like a date, delete by date; otherwise by ObjectId
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const menu = await DailyMenu.findOneAndDelete({ date: id });
    if (!menu) return notFound(c, 'Daily menu');
    return c.json({ success: true, data: { message: 'Daily menu deleted' } });
  }

  const menu = await DailyMenu.findByIdAndDelete(id);
  if (!menu) return notFound(c, 'Daily menu');
  return c.json({ success: true, data: { message: 'Daily menu deleted' } });
});

export default menus;
