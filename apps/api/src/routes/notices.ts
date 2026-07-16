import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination } from '../lib/routeUtils.js';
import { NoticePost } from '../models/noticePost.js';
import { Tenant } from '../models/tenant.js';
import { Room } from '../models/room.js';
import { Guardian } from '../models/guardian.js';
import { requireFeature } from '../middleware/featureFlags.js';
import { writeAuditLog } from '../lib/write-audit-log.js';

const notices = new Hono();
notices.use('*', requireFeature('noticeBoardEnabled'));

/**
 * N1/N2: Resolve floor/room for portal notice feed from tenant (or guardian ward),
 * not from JWT (JWT only has sub + role).
 */
async function resolvePortalTargetContext(user: {
  sub: string;
  role: string;
}): Promise<{ floorId?: string; roomId?: string; userId: string }> {
  const userId = user.sub;
  if (user.role === 'tenant') {
    const tenant = await Tenant.findOne({ userId, isActive: true } as Record<string, unknown>)
      .select('roomId')
      .lean();
    if (!tenant?.roomId) return { userId };
    const roomId = String(tenant.roomId);
    const room = await Room.findById(tenant.roomId).select('floorId').lean();
    return {
      userId,
      roomId,
      floorId: room?.floorId ? String(room.floorId) : undefined,
    };
  }
  if (user.role === 'guardian') {
    const guardian = await Guardian.findOne({
      userId,
      isActive: true,
    } as Record<string, unknown>)
      .select('tenantId')
      .lean();
    if (!guardian?.tenantId) return { userId };
    const tenant = await Tenant.findById(guardian.tenantId).select('roomId isActive').lean();
    if (!tenant?.roomId || tenant.isActive === false) return { userId };
    const roomId = String(tenant.roomId);
    const room = await Room.findById(tenant.roomId).select('floorId').lean();
    return {
      userId,
      roomId,
      floorId: room?.floorId ? String(room.floorId) : undefined,
    };
  }
  return { userId };
}

// ── Schemas ─────────────────────────────────────────────
const createNoticeSchema = z.strictObject({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters')
    .trim(),
  content: z
    .string()
    .min(10, 'Content must be at least 10 characters')
    .max(5000, 'Content cannot exceed 5000 characters')
    .trim(),
  pinned: z.boolean().optional().default(false),
  targetType: z.enum(['all', 'floor', 'room', 'individual']),
  targetIds: z.array(z.string()).optional().default([]),
});

const updateNoticeSchema = z.strictObject({
  title: createNoticeSchema.shape.title.optional(),
  content: createNoticeSchema.shape.content.optional(),
  pinned: z.boolean().optional(),
  targetType: z.enum(['all', 'floor', 'room', 'individual']).optional(),
  targetIds: z.array(z.string()).optional(),
});

// ── GET /notices ────────────────────────────────────────
notices.get('/', authGuard, async (c) => {
  const user = c.get('user');

  // Admin list with pagination (admin UI uses this endpoint)
  if (user.role === 'admin') {
    const pagination = parsePagination(c);
    const targetType = c.req.query('targetType');
    const search = c.req.query('search');

    const filter: Record<string, unknown> = {};
    if (targetType && ['all', 'floor', 'room', 'individual'].includes(targetType)) {
      filter.targetType = targetType;
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      NoticePost.find(filter)
        .sort({ pinned: -1, createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .populate('author', 'name email')
        .lean(),
      NoticePost.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      data,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  }

  // Tenant/guardian feed — resolve room/floor from DB (JWT has no floorId)
  const ctx = await resolvePortalTargetContext({ sub: user.sub, role: user.role });
  const orConditions: Record<string, unknown>[] = [{ targetType: 'all' }];

  if (ctx.floorId) {
    orConditions.push({
      targetType: 'floor',
      targetIds: ctx.floorId,
    });
  }

  if (ctx.roomId) {
    orConditions.push({
      targetType: 'room',
      targetIds: ctx.roomId,
    });
  }

  orConditions.push({
    targetType: 'individual',
    targetIds: ctx.userId,
  });

  const data = await NoticePost.find({ $or: orConditions })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(20)
    .populate('author', 'name email')
    .lean();

  return c.json({ success: true, data });
});

// ── GET /notices/admin ─────────────────────────────────
notices.get('/admin', authGuard, adminOnly, async (c) => {
  const pagination = parsePagination(c);
  const targetType = c.req.query('targetType');

  const filter: Record<string, unknown> = {};
  if (targetType && ['all', 'floor', 'room', 'individual'].includes(targetType)) {
    filter.targetType = targetType;
  }

  const [data, total] = await Promise.all([
    NoticePost.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('author', 'name email')
      .lean(),
    NoticePost.countDocuments(filter),
  ]);

  return c.json({
    success: true,
    data,
    meta: {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    },
  });
});

// ── GET /notices/:id ────────────────────────────────────
notices.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notice ID');

  const notice = await NoticePost.findById(id).populate('author', 'name email').lean();
  if (!notice) return notFound(c, 'Notice');

  return c.json({ success: true, data: notice });
});

// ── POST /notices ───────────────────────────────────────
notices.post('/', authGuard, adminOnly, zValidator('json', createNoticeSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  const notice = await (
    NoticePost as unknown as { create: (doc: Record<string, unknown>) => Promise<{ _id: string }> }
  ).create({
    ...body,
    authorId: user.sub,
  });

  const noticeId = String((notice as { _id: string })._id);
  await writeAuditLog({
    userId: user.sub,
    action: 'create',
    resource: 'notice',
    resourceId: noticeId,
    details: { title: body.title, targetType: body.targetType },
  });

  const populated = await NoticePost.findById(noticeId).populate('author', 'name email').lean();

  return c.json({ success: true, data: populated }, 201);
});

// ── PUT /notices/:id ────────────────────────────────────
notices.put('/:id', authGuard, adminOnly, zValidator('json', updateNoticeSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notice ID');

  const body = c.req.valid('json');
  const user = c.get('user');

  const notice = await NoticePost.findByIdAndUpdate(id, body, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('author', 'name email')
    .lean();

  if (!notice) return notFound(c, 'Notice');

  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'notice',
    resourceId: id,
    details: { fields: Object.keys(body) },
  });

  return c.json({ success: true, data: notice });
});

// ── DELETE /notices/:id ─────────────────────────────────
notices.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notice ID');

  const user = c.get('user');
  const notice = await NoticePost.findByIdAndDelete(id);
  if (!notice) return notFound(c, 'Notice');

  await writeAuditLog({
    userId: user.sub,
    action: 'delete',
    resource: 'notice',
    resourceId: id,
  });

  return c.json({ success: true, data: { message: 'Notice deleted' } });
});

export default notices;
