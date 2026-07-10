import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { Visitor } from '../models/visitor.js';
import { Tenant } from '../models/tenant.js';
import mongoose from 'mongoose';

const visitors = new Hono();

// ── Schemas ─────────────────────────────────────────────
// Matches the Mongoose model fields: visitorName, visitorPhone, expectedArrival
const createVisitorSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant is required'),
  visitorName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  visitorPhone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be +91 format Indian mobile number'),
  purpose: z.string().min(1, 'Purpose is required').max(200),
  expectedArrival: z.string().min(1, 'Expected arrival is required'),
});

const updateVisitorSchema = z.strictObject({
  visitorName: z.string().min(2).max(100).optional(),
  visitorPhone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Must be +91 format Indian mobile number')
    .optional(),
  purpose: z.string().min(1).max(200).optional(),
  expectedArrival: z.string().optional(),
  status: z.enum(['expected', 'arrived', 'departed', 'cancelled']).optional(),
});

// ── POST /visitors ──────────────────────────────────────
visitors.post('/', authGuard, tenantOnly, zValidator('json', createVisitorSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();
  if (!tenant) {
    return notFound(c, 'Active tenant profile');
  }

  const doc = new Visitor({
    tenantId: new mongoose.Types.ObjectId(body.tenantId),
    visitorName: body.visitorName,
    visitorPhone: body.visitorPhone,
    purpose: body.purpose,
    expectedArrival: new Date(body.expectedArrival),
    status: 'expected',
  });
  await doc.save();

  const populated = await Visitor.findById(doc._id)
    .populate({ path: 'tenant', populate: { path: 'user', select: 'name email phone' } })
    .lean();

  return c.json({ success: true, data: populated }, 201);
});

// ── GET /visitors ───────────────────────────────────────
visitors.get('/', authGuard, adminOnly, async (c) => {
  const filter: Record<string, unknown> = {};

  const status = c.req.query('status');
  if (status) filter.status = status;

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    Visitor.find(safeFilter(filter))
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenant', populate: { path: 'user', select: 'name email phone' } })
      .lean(),
    Visitor.countDocuments(safeFilter(filter)),
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

// ── GET /visitors/:id ─────────────────────────────────
visitors.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const visitor = await Visitor.findById(id)
    .populate({
      path: 'tenant',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'room', select: 'roomNumber' },
      ],
    })
    .lean();

  if (!visitor) return notFound(c, 'Visitor');
  return c.json({ success: true, data: visitor });
});

// ── POST /visitors/:id/approve ──────────────────────────
visitors.post('/:id/approve', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const user = c.get('user');
  const visitor = await Visitor.findByIdAndUpdate(
    id,
    {
      status: 'expected',
      approvedBy: new mongoose.Types.ObjectId(user.sub),
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
visitors.put('/:id', authGuard, adminOnly, zValidator('json', updateVisitorSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const body = c.req.valid('json');

  const updateData: Record<string, unknown> = {};
  if (body.visitorName !== undefined) updateData.visitorName = body.visitorName;
  if (body.visitorPhone !== undefined) updateData.visitorPhone = body.visitorPhone;
  if (body.purpose !== undefined) updateData.purpose = body.purpose;
  if (body.expectedArrival !== undefined)
    updateData.expectedArrival = new Date(body.expectedArrival);
  if (body.status !== undefined) updateData.status = body.status;

  const visitor = await Visitor.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();
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
    .sort({ createdAt: -1 })
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
