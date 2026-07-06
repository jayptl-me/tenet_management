import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { PipelineStage } from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { MealFeedback } from '../models/mealFeedback.js';
import { Tenant } from '../models/tenant.js';

const meals = new Hono();

// ── Schemas ─────────────────────────────────────────────
const createFeedbackSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  categories: z
    .array(z.enum(['taste', 'variety', 'quantity', 'cleanliness', 'service']))
    .min(1, 'At least one category is required'),
  comment: z.string().max(500, 'Comment cannot exceed 500 characters').optional(),
});

// ── POST /meals/feedback ────────────────────────────────
meals.post(
  '/feedback',
  authGuard,
  tenantOnly,
  zValidator('json', createFeedbackSchema),
  async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('user').sub;

    const tenant = await Tenant.findOne(safeFilter({ userId })).lean();
    if (!tenant) {
      return notFound(c, 'Tenant profile');
    }

    const filter = {
      tenantId: tenant._id,
      date: body.date,
      mealType: body.mealType,
    };

    const feedback = await MealFeedback.findOneAndUpdate(
      filter as Record<string, unknown>,
      {
        ...filter,
        rating: body.rating,
        categories: body.categories,
        comment: body.comment ?? '',
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    return c.json({ success: true, data: feedback }, 201);
  },
);

// ── GET /meals/feedback/summary ─────────────────────────
meals.get('/feedback/summary', authGuard, adminOnly, async (c) => {
  const matchFilter: Record<string, unknown> = {};

  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, unknown> = {};
    if (dateFrom) dateFilter.$gte = dateFrom;
    if (dateTo) dateFilter.$lte = dateTo;
    matchFilter.date = dateFilter;
  }

  const pipeline: PipelineStage[] = [];

  if (Object.keys(matchFilter).length > 0) {
    pipeline.push({ $match: matchFilter } as PipelineStage);
  }

  pipeline.push({
    $group: {
      _id: { date: '$date', mealType: '$mealType' },
      avgRating: { $avg: '$rating' },
      count: { $sum: 1 },
    },
  } as PipelineStage);

  pipeline.push({ $sort: { '_id.date': -1, '_id.mealType': 1 } } as PipelineStage);

  const results = await MealFeedback.aggregate(pipeline);

  const data = results.map((entry: Record<string, unknown>) => ({
    date: (entry._id as Record<string, unknown>).date,
    mealType: (entry._id as Record<string, unknown>).mealType,
    avgRating: Math.round(((entry.avgRating as number) ?? 0) * 100) / 100,
    count: entry.count,
  }));

  return c.json({ success: true, data });
});

// ── GET /meals/feedback/my ──────────────────────────────
meals.get('/feedback/my', authGuard, tenantOnly, async (c) => {
  const userId = c.get('user').sub;

  const tenant = await Tenant.findOne(safeFilter({ userId })).lean();
  if (!tenant) {
    return notFound(c, 'Tenant profile');
  }

  const data = await MealFeedback.find({ tenantId: tenant._id } as Record<string, unknown>)
    .sort({ date: -1 })
    .limit(30)
    .lean();

  return c.json({ success: true, data });
});

// ── GET /meals/feedback ─────────────────────────────────
meals.get('/feedback', authGuard, adminOnly, async (c) => {
  const filter: Record<string, unknown> = {};

  const date = c.req.query('date');
  if (date) filter.date = date;

  const mealType = c.req.query('mealType');
  if (mealType) filter.mealType = mealType;

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    MealFeedback.find(filter as Record<string, unknown>)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenant', populate: { path: 'user', select: 'name' } })
      .lean(),
    MealFeedback.countDocuments(filter as Record<string, unknown>),
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

export default meals;
