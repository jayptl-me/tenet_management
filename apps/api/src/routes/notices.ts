import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination } from '../lib/routeUtils.js';
import { NoticePost } from '../models/noticePost.js';

const notices = new Hono();

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
  targetType: z.enum(['all', 'floor', 'individual']),
  targetIds: z.array(z.string()).optional().default([]),
});

const updateNoticeSchema = createNoticeSchema.partial();

// ── GET /notices ────────────────────────────────────────
notices.get('/', authGuard, async (c) => {
  const user = c.get('user');
  const userFloorId = user.floorId;

  const orConditions: Record<string, unknown>[] = [{ targetType: 'all' }];

  if (userFloorId) {
    orConditions.push({
      targetType: 'floor',
      targetIds: userFloorId,
    });
  }

  orConditions.push({
    targetType: 'individual',
    targetIds: user.sub,
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
  if (targetType && ['all', 'floor', 'individual'].includes(targetType)) {
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

  const populated = await NoticePost.findById((notice as { _id: string })._id)
    .populate('author', 'name email')
    .lean();

  return c.json({ success: true, data: populated }, 201);
});

// ── PUT /notices/:id ────────────────────────────────────
notices.put('/:id', authGuard, adminOnly, zValidator('json', updateNoticeSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notice ID');

  const body = c.req.valid('json');

  const notice = await NoticePost.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  })
    .populate('author', 'name email')
    .lean();

  if (!notice) return notFound(c, 'Notice');
  return c.json({ success: true, data: notice });
});

// ── DELETE /notices/:id ─────────────────────────────────
notices.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid notice ID');

  const notice = await NoticePost.findByIdAndDelete(id);
  if (!notice) return notFound(c, 'Notice');
  return c.json({ success: true, data: { message: 'Notice deleted' } });
});

export default notices;
