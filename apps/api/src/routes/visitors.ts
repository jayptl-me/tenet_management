import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { Visitor } from '../models/visitor.js';
import { Tenant } from '../models/tenant.js';
import mongoose from 'mongoose';
import { requireFeature } from '../middleware/featureFlags.js';

const visitors = new Hono();
visitors.use('*', requireFeature('visitorManagementEnabled'));

// ── Schemas ─────────────────────────────────────────────
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

/** Normalize lean visitor for FE (name aliases + keep raw fields). */
function mapVisitor(doc: Record<string, unknown>) {
  return {
    ...doc,
    visitorName: doc.visitorName ?? doc.name,
    visitorPhone: doc.visitorPhone ?? doc.phone,
    name: doc.visitorName ?? doc.name,
    phone: doc.visitorPhone ?? doc.phone,
  };
}

// ── POST /visitors — admin or tenant ────────────────────
visitors.post('/', authGuard, zValidator('json', createVisitorSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');
  const role = user?.role;

  let tenantId = body.tenantId;

  if (role === 'tenant') {
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();
    if (!tenant) {
      return notFound(c, 'Active tenant profile');
    }
    // Tenants can only register visitors against their own profile
    tenantId = String(tenant._id);
  } else if (role === 'admin') {
    const tenant = await Tenant.findById(body.tenantId).lean();
    if (!tenant) return notFound(c, 'Tenant');
  } else {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins or tenants can register visitors.' },
      },
      403,
    );
  }

  const doc = new Visitor({
    tenantId: new mongoose.Types.ObjectId(tenantId),
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

  return c.json(
    { success: true, data: mapVisitor(populated as unknown as Record<string, unknown>) },
    201,
  );
});

// ── GET /visitors ───────────────────────────────────────
visitors.get('/', authGuard, adminOnly, async (c) => {
  const filter: Record<string, unknown> = {};

  const status = c.req.query('status');
  if (status) filter.status = status;

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [raw, total] = await Promise.all([
    Visitor.find(safeFilter(filter))
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenant', populate: { path: 'user', select: 'name email phone' } })
      .lean(),
    Visitor.countDocuments(safeFilter(filter)),
  ]);

  const data = (raw as unknown[]).map((d) => mapVisitor(d as Record<string, unknown>));

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

// ── GET /visitors/my — static before /:id ────────────────
visitors.get('/my', authGuard, tenantOnly, async (c) => {
  const user = c.get('user');
  const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();

  if (!tenant) {
    return notFound(c, 'Active tenant profile');
  }

  const raw = await Visitor.find(safeFilter({ tenantId: tenant._id }))
    .sort({ createdAt: -1 })
    .lean();

  const data = (raw as unknown[]).map((d) => mapVisitor(d as Record<string, unknown>));

  return c.json({ success: true, data });
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
  return c.json({
    success: true,
    data: mapVisitor(visitor as unknown as Record<string, unknown>),
  });
});

// ── POST /visitors/:id/approve ──────────────────────────
visitors.post('/:id/approve', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const user = c.get('user');
  const visitor = await Visitor.findById(id).lean();
  if (!visitor) return notFound(c, 'Visitor');

  // Transition state machine: only 'cancelled' visitors can be re-approved
  if (visitor.status !== 'cancelled') {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot approve a visitor with status '${visitor.status}'. Only cancelled visitors can be re-approved.`,
        },
      },
      409,
    );
  }

  const updated = await Visitor.findByIdAndUpdate(
    id,
    {
      status: 'expected',
      approvedBy: new mongoose.Types.ObjectId(user.sub),
    },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) return notFound(c, 'Visitor');
  return c.json({
    success: true,
    data: mapVisitor(updated as unknown as Record<string, unknown>),
  });
});

// ── POST /visitors/:id/arrive ───────────────────────────
visitors.post('/:id/arrive', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const user = c.get('user');
  const role = user?.role;

  const visitor = await Visitor.findById(id).lean();
  if (!visitor) return notFound(c, 'Visitor');

  // Ownership: admin can act on any visitor; tenant can only act on their own
  if (role === 'tenant') {
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();
    if (!tenant || String(tenant._id) !== String(visitor.tenantId)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only manage your own visitors.' },
        },
        403,
      );
    }
  } else if (role !== 'admin') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins or tenants can manage visitors.' },
      },
      403,
    );
  }

  // Transition state machine: only 'expected' visitors can arrive
  if (visitor.status !== 'expected') {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot arrive a visitor with status '${visitor.status}'. Visitor must be in 'expected' state.`,
        },
      },
      409,
    );
  }

  const updated = await Visitor.findByIdAndUpdate(
    id,
    {
      status: 'arrived',
      actualArrival: new Date(),
    },
    { returnDocument: 'after' },
  ).lean();

  return c.json({ success: true, data: mapVisitor(updated as unknown as Record<string, unknown>) });
});

// ── POST /visitors/:id/depart ───────────────────────────
visitors.post('/:id/depart', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid visitor ID');

  const user = c.get('user');
  const role = user?.role;

  const visitor = await Visitor.findById(id).lean();
  if (!visitor) return notFound(c, 'Visitor');

  // Ownership: admin can act on any visitor; tenant can only act on their own
  if (role === 'tenant') {
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();
    if (!tenant || String(tenant._id) !== String(visitor.tenantId)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only manage your own visitors.' },
        },
        403,
      );
    }
  } else if (role !== 'admin') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins or tenants can manage visitors.' },
      },
      403,
    );
  }

  // Transition state machine: only 'arrived' visitors can depart
  if (visitor.status !== 'arrived') {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot depart a visitor with status '${visitor.status}'. Visitor must be in 'arrived' state.`,
        },
      },
      409,
    );
  }

  const updated = await Visitor.findByIdAndUpdate(
    id,
    {
      status: 'departed',
      actualDeparture: new Date(),
    },
    { returnDocument: 'after' },
  ).lean();

  return c.json({ success: true, data: mapVisitor(updated as unknown as Record<string, unknown>) });
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

  return c.json({
    success: true,
    data: mapVisitor(visitor as unknown as Record<string, unknown>),
  });
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
