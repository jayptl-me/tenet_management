import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, parsePagination } from '../lib/routeUtils.js';
import { DailyMenu } from '../models/dailyMenu.js';

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

// ── GET /menus/today ────────────────────────────────────
menus.get('/today', authGuard, async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const menu = await DailyMenu.findOne({ date: today }).lean();
  if (!menu) return notFound(c, "Today's menu");
  return c.json({ success: true, data: menu });
});

// ── GET /menus ──────────────────────────────────────────
menus.get('/', authGuard, async (c) => {
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  const isActive = c.req.query('isActive');

  const filter: Record<string, unknown> = {};
  if (fromDate || toDate) {
    const dateFilter: Record<string, string> = {};
    if (fromDate) dateFilter.$gte = fromDate;
    if (toDate) dateFilter.$lte = toDate;
    filter.date = dateFilter;
  }
  if (isActive !== undefined && isActive !== '') {
    filter.isActive = isActive === 'true';
  }

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    DailyMenu.find(filter)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .lean(),
    DailyMenu.countDocuments(filter),
  ]);

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

// ── GET /menus/:id ──────────────────────────────────────────
menus.get('/:id', authGuard, async (c) => {
  const id = c.req.param('id');
  const menu = await DailyMenu.findById(id).lean();
  if (!menu) return notFound(c, 'Daily menu');
  return c.json({ success: true, data: menu });
});

// ── PUT /menus/:id ──────────────────────────────────────
menus.put('/:id', authGuard, adminOnly, zValidator('json', menuDaySchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  // Reject edits to past dates
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(id) ? id : body.date;
  const today = new Date().toISOString().slice(0, 10);
  if (targetDate && targetDate < today) {
    return c.json(
      {
        success: false,
        error: { code: 'PAST_DATE', message: 'Cannot edit menus for past dates.' },
      },
      422,
    );
  }

  // If param looks like a date (YYYY-MM-DD), upsert by date; otherwise find by ObjectId
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const menu = await DailyMenu.findOneAndUpdate(
      { date: id },
      { ...body, date: id },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).lean();
    return c.json({ success: true, data: menu });
  }

  const menu = await DailyMenu.findByIdAndUpdate(id, body, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();
  if (!menu) return notFound(c, 'Daily menu');
  return c.json({ success: true, data: menu });
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
