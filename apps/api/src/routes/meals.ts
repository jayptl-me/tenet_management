import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { PipelineStage } from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { MealFeedback } from '../models/mealFeedback.js';
import { Tenant } from '../models/tenant.js';
import { User } from '../models/user.js';
import { requireFeature } from '../middleware/featureFlags.js';
import { writeAuditLog } from '../lib/write-audit-log.js';
import { publishEvent } from '../lib/eventBus.js';

const meals = new Hono();
meals.use('*', requireFeature('messFeedbackEnabled'));

/**
 * Normalize the two populate shapes (list uses virtual tenant->user/room,
 * detail uses tenantId->userId/roomId) into one host stay chain so admin
 * list/detail/edit render identically.
 */
function mapMealFeedback(doc: Record<string, unknown>) {
  const t = (doc.tenant ?? doc.tenantId) as Record<string, unknown> | undefined;
  const user = (t?.user ?? t?.userId) as Record<string, unknown> | undefined;
  const room = (t?.room ?? t?.roomId) as Record<string, unknown> | undefined;
  const floor = room?.floor as Record<string, unknown> | undefined;
  return {
    ...doc,
    tenant: t
      ? {
          _id: String(t._id ?? ''),
          bedId: (t.bedId as string | undefined) ?? null,
          user: user
            ? {
                _id: String(user._id ?? ''),
                name: user.name,
                email: user.email,
                phone: user.phone,
              }
            : null,
          room: room
            ? {
                _id: String(room._id ?? ''),
                roomNumber: room.roomNumber,
                floor:
                  floor && typeof floor === 'object' && 'label' in floor
                    ? {
                        _id: String(floor._id ?? ''),
                        label: floor.label,
                        floorNumber: floor.floorNumber,
                      }
                    : null,
              }
            : null,
        }
      : null,
  };
}

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

const adminCreateFeedbackSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  categories: z
    .array(z.enum(['taste', 'variety', 'quantity', 'cleanliness', 'service']))
    .optional(),
  comment: z.string().max(500, 'Comment cannot exceed 500 characters').optional(),
});

// ── POST /meals — admin records feedback for a tenant ─────
meals.post('/', authGuard, adminOnly, zValidator('json', adminCreateFeedbackSchema), async (c) => {
  const body = c.req.valid('json');

  const todayStr = new Date().toISOString().slice(0, 10);
  if (body.date > todayStr) {
    return badRequest(c, 'Cannot submit feedback for a future date', 'FUTURE_DATE_INVALID');
  }

  const tenant = await Tenant.findById(body.tenantId).lean();
  if (!tenant) return notFound(c, 'Tenant profile');

  const filter = {
    tenantId: body.tenantId,
    date: body.date,
    mealType: body.mealType,
  };

  const feedback = await MealFeedback.findOneAndUpdate(
    filter as Record<string, unknown>,
    {
      ...filter,
      rating: body.rating,
      categories: body.categories ?? ['taste'],
      comment: body.comment ?? '',
      // Re-recorded feedback re-enters triage like tenant resubmits do.
      status: 'submitted',
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();

  const adminUserId = (c.get('user') as { sub?: string })?.sub ?? 'system';
  await writeAuditLog({
    userId: adminUserId,
    action: 'create',
    resource: 'meal_feedback',
    resourceId: String((feedback as { _id: unknown })._id),
    details: {
      tenantId: body.tenantId,
      date: body.date,
      mealType: body.mealType,
      rating: body.rating,
    },
    ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: feedback }, 201);
});

// ── POST /meals/feedback ────────────────────────────────
meals.post(
  '/feedback',
  authGuard,
  tenantOnly,
  zValidator('json', createFeedbackSchema),
  async (c) => {
    const body = c.req.valid('json');

    const todayStr = new Date().toISOString().slice(0, 10);
    if (body.date > todayStr) {
      return badRequest(c, 'Cannot submit feedback for a future date', 'FUTURE_DATE_INVALID');
    }

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

    // Re-submit resets status so admin re-triages (actioned feedback must reappear).
    const feedback = await MealFeedback.findOneAndUpdate(
      filter as Record<string, unknown>,
      {
        ...filter,
        rating: body.rating,
        categories: body.categories,
        comment: body.comment ?? '',
        status: 'submitted',
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).lean();

    publishEvent('meal_feedback_submitted', {
      feedbackId: (feedback as { _id: unknown })?._id,
      tenantId: tenant._id,
      date: body.date,
      mealType: body.mealType,
      rating: body.rating,
    });

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

  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') ?? 30)));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    MealFeedback.find({ tenantId: tenant._id } as Record<string, unknown>)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MealFeedback.countDocuments({ tenantId: tenant._id } as Record<string, unknown>),
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

// ── GET /meals/feedback ─────────────────────────────────
meals.get('/feedback', authGuard, adminOnly, async (c) => {
  const filter: Record<string, unknown> = {};

  const date = c.req.query('date');
  if (date) filter.date = date;

  const mealType = c.req.query('mealType');
  if (mealType) {
    if (!['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return badRequest(c, 'Invalid mealType filter', 'INVALID_MEAL_TYPE');
    }
    filter.mealType = mealType;
  }

  const status = c.req.query('status');
  if (status) {
    if (!['submitted', 'acknowledged', 'actioned'].includes(status)) {
      return badRequest(c, 'Invalid status filter', 'INVALID_STATUS');
    }
    filter.status = status;
  }

  const rating = c.req.query('rating');
  if (rating) filter.rating = Number(rating);

  const search = c.req.query('search');

  // Resolve search by tenant name (same pattern as tenants route)
  if (search) {
    const users = await User.find(safeFilter({ name: { $regex: search, $options: 'i' } }))
      .select('_id')
      .lean();
    const userIds = users.map((u) => u._id);

    if (userIds.length === 0) {
      return c.json({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 25, totalPages: 0 },
      });
    }

    const tenants = await Tenant.find(safeFilter({ userId: { $in: userIds } }))
      .select('_id')
      .lean();
    const tenantIds = tenants.map((t) => String(t._id));
    filter.tenantId = { $in: tenantIds };
  }

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    MealFeedback.find(filter as Record<string, unknown>)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'tenant',
        populate: [
          { path: 'user', select: 'name email phone' },
          {
            path: 'room',
            select: 'roomNumber floor',
            populate: { path: 'floor', select: 'label floorNumber' },
          },
        ],
      })
      .lean(),
    MealFeedback.countDocuments(filter as Record<string, unknown>),
  ]);

  return c.json({
    success: true,
    data: (data as unknown as Record<string, unknown>[]).map(mapMealFeedback),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /meals/:id ──────────────────────────────────────
meals.get('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid meal feedback ID');

  const feedback = await MealFeedback.findById(id)
    .populate({
      path: 'tenantId',
      populate: [
        { path: 'userId', select: 'name email phone' },
        {
          path: 'roomId',
          select: 'roomNumber floor',
          populate: { path: 'floor', select: 'label floorNumber' },
        },
      ],
    })
    .lean();

  if (!feedback) return notFound(c, 'Meal feedback');

  return c.json({
    success: true,
    data: mapMealFeedback(feedback as unknown as Record<string, unknown>),
  });
});

// ── PUT /meals/:id ──────────────────────────────────────
meals.put(
  '/:id',
  authGuard,
  adminOnly,
  zValidator(
    'json',
    z.strictObject({
      mealType: z.enum(['breakfast', 'lunch', 'dinner']).optional(),
      rating: z.number().int().min(1).max(5).optional(),
      comment: z.string().max(500).optional(),
      status: z.enum(['submitted', 'acknowledged', 'actioned']).optional(),
      categories: z
        .array(z.enum(['taste', 'variety', 'quantity', 'cleanliness', 'service']))
        .optional(),
    }),
  ),
  async (c) => {
    const id = c.req.param('id');
    if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(c, 'Invalid meal feedback ID');
    const body = c.req.valid('json');
    try {
      const feedback = await MealFeedback.findByIdAndUpdate(id, body, {
        returnDocument: 'after',
        runValidators: true,
      }).lean();
      if (!feedback) return notFound(c, 'Meal feedback');

      const adminUserId = (c.get('user') as { sub?: string })?.sub ?? 'system';
      await writeAuditLog({
        userId: adminUserId,
        action: 'update',
        resource: 'meal_feedback',
        resourceId: id,
        details: body,
        ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
        userAgent: c.req.header('user-agent'),
      });

      return c.json({ success: true, data: feedback });
    } catch (err: unknown) {
      // Unique compound tenantId+date+mealType — e.g. changing mealType collides
      if ((err as { code?: number }).code === 11000) {
        return c.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_FEEDBACK',
              message: 'A feedback entry already exists for this tenant, date, and meal type.',
            },
          },
          409,
        );
      }
      throw err;
    }
  },
);

// ── DELETE /meals/:id ───────────────────────────────────
meals.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = c.req.param('id');
  if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(c, 'Invalid meal feedback ID');
  const feedback = await MealFeedback.findByIdAndDelete(id);
  if (!feedback) return notFound(c, 'Meal feedback');

  const adminUserId = (c.get('user') as { sub?: string })?.sub ?? 'system';
  await writeAuditLog({
    userId: adminUserId,
    action: 'delete',
    resource: 'meal_feedback',
    resourceId: id,
    details: {
      date: (feedback as { date?: string }).date,
      mealType: (feedback as { mealType?: string }).mealType,
      rating: (feedback as { rating?: number }).rating,
    },
    ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: { message: 'Meal feedback deleted' } });
});

export default meals;
