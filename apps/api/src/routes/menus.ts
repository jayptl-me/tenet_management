import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound } from '../lib/routeUtils.js';
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

  const filter: Record<string, unknown> = {};
  if (fromDate || toDate) {
    const dateFilter: Record<string, string> = {};
    if (fromDate) dateFilter.$gte = fromDate;
    if (toDate) dateFilter.$lte = toDate;
    filter.date = dateFilter;
  }

  const data = await DailyMenu.find(filter).sort({ date: -1 }).limit(30).lean();

  return c.json({ success: true, data });
});

// ── PUT /menus/:date ────────────────────────────────────
menus.put('/:date', authGuard, adminOnly, zValidator('json', menuDaySchema), async (c) => {
  const date = c.req.param('date');
  const body = c.req.valid('json');

  const menu = await DailyMenu.findOneAndUpdate(
    { date },
    { ...body, date },
    { upsert: true, new: true, runValidators: true },
  ).lean();

  return c.json({ success: true, data: menu });
});

// ── DELETE /menus/:date ─────────────────────────────────
menus.delete('/:date', authGuard, adminOnly, async (c) => {
  const date = c.req.param('date');
  const menu = await DailyMenu.findOneAndDelete({ date });
  if (!menu) return notFound(c, 'Daily menu');
  return c.json({ success: true, data: { message: 'Daily menu deleted' } });
});

export default menus;
