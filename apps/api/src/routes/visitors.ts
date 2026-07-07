import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { Visitor } from '../models/visitor.js';
import { Tenant } from '../models/tenant.js';

const visitors = new Hono();

// ── Schemas ─────────────────────────────────────────────
const createVisitorSchema = z.strictObject({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be +91 format Indian mobile number'),
  purpose: z.enum(['delivery', 'guest', 'interview', 'maintenance', 'other']),
  expectedVisitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  expectedVisitTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
  notes: z.string().max(300, 'Notes cannot exceed 300 characters').optional(),
});

type CreateFunc = (doc: Record<string, unknown>) => Promise<{ _id: string }>;

// ── POST /visitors ──────────────────────────────────────
visitors.post('/', authGuard, tenantOnly, zValidator('json', createVisitorSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();
  if (!tenant) {
    return notFound(c, 'Active tenant profile');
  }

  const visitor = await (Visitor as unknown as { create: CreateFunc }).create({
    ...body,
    tenantId: tenant._id,
    roomId: tenant.roomId,
  });

  const populated = await Visitor.findById((visitor as { _id: string })._id)
    .populate({ path: 'tenant', populate: { path: 'user', select: 'name' } })
    .lean();

  return c.json({ success: true, data: populated }, 201);
});

// ── GET /visitors ───────────────────────────────────────
visitors.get('/', authGuard, adminOnly, async (c) => {
  const filter: Record<string, unknown> = {};

  const status = c.req.query('status');
  if (status) filter.status = status;

  const date = c.req.query('date');
  if (date) filter.expectedVisitDate = date;

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    Visitor.find(filter as Record<string, unknown>)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenant', populate: { path: 'user', select: 'name' } })
      .lean(),
    Visitor.countDocuments(filter as Record<string, unknown>),
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

// ── POST /visitors/:id/approve ──────────────────────────
visitors.post('/:id/approve', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const user = c.get('user');
  const visitor = await Visitor.findByIdAndUpdate(
    id,
    {
      status: 'approved',
      approvedBy: user.sub,
      approvedAt: new Date(),
    },
    { returnDocument: 'after' },
  ).lean();

  if (!visitor) return notFound(c, 'Visitor');
  return c.json({ success: true, data: visitor });
});

// ── POST /visitors/:id/arrive ───────────────────────────
visitors.post('/:id/arrive', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const visitor = await Visitor.findByIdAndUpdate(
    id,
    {
      status: 'arrived',
      actualArrival: new Date(),
    },
    { returnDocument: 'after' },
  ).lean();

  if (!visitor) return notFound(c, 'Visitor');
  return c.json({ success: true, data: visitor });
});

// ── POST /visitors/:id/depart ───────────────────────────
visitors.post('/:id/depart', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const visitor = await Visitor.findByIdAndUpdate(
    id,
    {
      status: 'departed',
      actualDeparture: new Date(),
    },
    { returnDocument: 'after' },
  ).lean();

  if (!visitor) return notFound(c, 'Visitor');
  return c.json({ success: true, data: visitor });
});

// ── PUT /visitors/:id ───────────────────────────────────
visitors.put('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return badRequest(c, 'Invalid JSON body');
  }

  const allowedFields = ['name', 'phone', 'purpose', 'expectedVisitDate', 'expectedVisitTime', 'notes', 'status'];
  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const visitor = await Visitor.findByIdAndUpdate(id, updateData, { returnDocument: 'after', runValidators: true }).lean();
  if (!visitor) return notFound(c, 'Visitor');

  return c.json({ success: true, data: visitor });
});

// ── GET /visitors/my ────────────────────────────────────
visitors.get('/my', authGuard, tenantOnly, async (c) => {
  const user = c.get('user');
  const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();

  if (!tenant) {
    return notFound(c, 'Active tenant profile');
  }

  const data = await Visitor.find(safeFilter({ tenantId: tenant._id }))
    .sort({ expectedVisitDate: -1 })
    .lean();

  return c.json({ success: true, data });
});


// ── DELETE /visitors/:id ────────────────────────────────
visitors.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = c.req.param('id');
  if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(c, 'Invalid visitor ID');
  const visitor = await Visitor.findByIdAndDelete(id);
  if (!visitor) return notFound(c, 'Visitor');
  return c.json({ success: true, data: { message: 'Visitor deleted' } });
});

export default visitors;
