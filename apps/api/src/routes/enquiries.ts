import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { publicLimiter } from '../middleware/rateLimiter.js';
import { notFound, badRequest, parseId, parsePagination } from '../lib/routeUtils.js';
import { Enquiry } from '../models/enquiry.js';
import { broadcastBadgesUpdate } from '../lib/broadcast-badges.js';
import { writeAuditLog } from '../lib/write-audit-log.js';

const enquiries = new Hono();

// ── Schemas (aligned with Enquiry model: preferredSharing, optional email) ──
const preferredSharingEnum = z.enum(['2', '3', '4', 'single']);
const sourceEnum = z.enum(['landing_page', 'referral', 'walk_in', 'phone_call', 'other']);

const createEnquirySchema = z.strictObject({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number (+91 followed by 10 digits)'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  preferredSharing: preferredSharingEnum,
  message: z.string().max(1000, 'Message cannot exceed 1000 characters').optional(),
  /** Admin create may set source; public landing always stored as landing_page. */
  source: sourceEnum.optional(),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

const updateStatusSchema = z.strictObject({
  status: z.enum(['new', 'contacted', 'converted', 'lost']),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

const updateEnquirySchema = z.strictObject({
  name: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number (+91 followed by 10 digits)')
    .optional(),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().max(1000).optional(),
  source: sourceEnum.optional(),
  status: z.enum(['new', 'contacted', 'converted', 'lost']).optional(),
  notes: z.string().max(1000).optional(),
  preferredSharing: preferredSharingEnum.optional(),
});

/** convertedTenantId -> tenant identity + room stay chain. */
const convertedTenantPopulate = {
  path: 'convertedTenantId',
  select: 'bedId',
  populate: [
    { path: 'user', select: 'name email phone' },
    { path: 'room', select: 'roomNumber' },
  ],
};

/**
 * Terminal states: converted is pinned (a tenant exists — never leave it);
 * lost may reopen to new/contacted. converted without a linked tenant is
 * rejected so the tenant link can never dangle.
 */
function assertEnquiryTransition(from: string, to: string, hasTenant: boolean): string | null {
  if (from === to) return null;
  if (to === 'converted' && !hasTenant) {
    return 'Mark converted only by creating the tenant (Convert to Tenant flow).';
  }
  if (from === 'converted') {
    return 'Converted enquiries are pinned to their tenant and cannot change status.';
  }
  if (from === 'lost' && to !== 'new' && to !== 'contacted') {
    return 'Lost enquiries can only reopen to new or contacted.';
  }
  return null;
}

// ── POST /enquiries ─────────────────────────────────────
enquiries.post('/', publicLimiter, zValidator('json', createEnquirySchema), async (c) => {
  const body = c.req.valid('json');

  const enquiry = await Enquiry.create({
    name: body.name,
    phone: body.phone,
    email: body.email || undefined,
    preferredSharing: body.preferredSharing,
    message: body.message ?? '',
    status: 'new',
    // Public landing and unauthenticated posts always land as landing_page unless admin source provided
    source: body.source ?? 'landing_page',
    notes: body.notes ?? '',
  });

  void broadcastBadgesUpdate();

  const authUser = c.get('user') as { sub?: string; id?: string } | undefined;
  const userId = authUser?.sub ?? authUser?.id;
  if (userId) {
    void writeAuditLog({
      userId,
      action: 'create',
      resource: 'enquiry',
      resourceId: enquiry.id,
      details: { name: enquiry.name, phone: enquiry.phone, source: enquiry.source },
      ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });
  }

  return c.json({ success: true, data: enquiry }, 201);
});

// ── GET /enquiries/stats ────────────────────────────────
enquiries.get('/stats', authGuard, adminOnly, async (c) => {
  const [statusCounts, sourceCounts, total] = await Promise.all([
    Enquiry.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Enquiry.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
    Enquiry.countDocuments(),
  ]);

  const byStatus: Record<string, number> = { new: 0, contacted: 0, converted: 0, lost: 0 };
  for (const entry of statusCounts) {
    if (entry._id) byStatus[entry._id as string] = entry.count;
  }

  const bySource: Record<string, number> = {
    landing_page: 0,
    referral: 0,
    walk_in: 0,
    phone_call: 0,
    other: 0,
  };
  for (const entry of sourceCounts) {
    if (entry._id) bySource[entry._id as string] = entry.count;
  }

  const convertedCount = byStatus.converted ?? 0;
  const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

  return c.json({
    success: true,
    data: {
      byStatus,
      bySource,
      total,
      conversionRate,
    },
  });
});

// ── GET /enquiries ──────────────────────────────────────
enquiries.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, skip } = parsePagination(c);
  const status = c.req.query('status');
  const source = c.req.query('source');
  const search = c.req.query('search')?.trim();
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');

  const filter: Record<string, unknown> = {};

  if (status) {
    if (!['new', 'contacted', 'converted', 'lost'].includes(status)) {
      return badRequest(c, 'Invalid status filter', 'INVALID_STATUS');
    }
    filter.status = status;
  }

  if (source) {
    if (!['landing_page', 'referral', 'walk_in', 'phone_call', 'other'].includes(source)) {
      return badRequest(c, 'Invalid source filter', 'INVALID_SOURCE');
    }
    filter.source = source;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
  }

  if (fromDate || toDate) {
    const createdAtFilter: Record<string, unknown> = {};
    if (fromDate) {
      createdAtFilter['$gte'] = new Date(fromDate);
    }
    if (toDate) {
      createdAtFilter['$lte'] = new Date(toDate);
    }
    filter.createdAt = createdAtFilter;
  }

  const [data, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate(convertedTenantPopulate)
      .lean(),
    Enquiry.countDocuments(filter as Record<string, unknown>),
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

// ── GET /enquiries/:id ──────────────────────────────────
enquiries.get('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid enquiry ID');

  const enquiry = await Enquiry.findById(id).populate(convertedTenantPopulate).lean();
  if (!enquiry) return notFound(c, 'Enquiry');

  return c.json({ success: true, data: enquiry });
});

// ── PUT /enquiries/:id/status ───────────────────────────
enquiries.put(
  '/:id/status',
  authGuard,
  adminOnly,
  zValidator('json', updateStatusSchema),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid enquiry ID');

    const body = c.req.valid('json');

    const current = await Enquiry.findById(id).lean();
    if (!current) return notFound(c, 'Enquiry');

    const transitionError = assertEnquiryTransition(
      (current as unknown as Record<string, unknown>).status as string,
      body.status,
      Boolean((current as unknown as Record<string, unknown>).convertedTenantId),
    );
    if (transitionError) {
      return c.json(
        { success: false, error: { code: 'INVALID_TRANSITION', message: transitionError } },
        409,
      );
    }

    const enquiry = await Enquiry.findByIdAndUpdate(id, body, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate(convertedTenantPopulate)
      .lean();

    if (!enquiry) return notFound(c, 'Enquiry');

    void broadcastBadgesUpdate();

    const authUser = c.get('user') as { sub?: string; id?: string } | undefined;
    const userId = authUser?.sub ?? authUser?.id;
    if (userId) {
      void writeAuditLog({
        userId,
        action: 'update',
        resource: 'enquiry',
        resourceId: id,
        details: { status: body.status, notes: body.notes },
        ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
        userAgent: c.req.header('user-agent'),
      });
    }

    return c.json({ success: true, data: enquiry });
  },
);

// ── PUT /enquiries/:id — full admin edit ─────────────────
enquiries.put('/:id', authGuard, adminOnly, zValidator('json', updateEnquirySchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid enquiry ID');

  const body = c.req.valid('json');
  const update: Record<string, unknown> = { ...body };
  if (body.email === '') update.email = undefined;

  if (body.status !== undefined) {
    const current = await Enquiry.findById(id).lean();
    if (!current) return notFound(c, 'Enquiry');
    const transitionError = assertEnquiryTransition(
      (current as unknown as Record<string, unknown>).status as string,
      body.status,
      Boolean((current as unknown as Record<string, unknown>).convertedTenantId),
    );
    if (transitionError) {
      return c.json(
        { success: false, error: { code: 'INVALID_TRANSITION', message: transitionError } },
        409,
      );
    }
  }

  const enquiry = await Enquiry.findByIdAndUpdate(id, update, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate(convertedTenantPopulate)
    .lean();

  if (!enquiry) return notFound(c, 'Enquiry');

  void broadcastBadgesUpdate();

  const authUser = c.get('user') as { sub?: string; id?: string } | undefined;
  const userId = authUser?.sub ?? authUser?.id;
  if (userId) {
    void writeAuditLog({
      userId,
      action: 'update',
      resource: 'enquiry',
      resourceId: id,
      details: { status: enquiry.status, source: enquiry.source },
      ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });
  }

  return c.json({ success: true, data: enquiry });
});

// ── DELETE /enquiries/:id ────────────────────────────────
enquiries.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid enquiry ID');

  const enquiry = await Enquiry.findByIdAndDelete(id);
  if (!enquiry) return notFound(c, 'Enquiry');

  void broadcastBadgesUpdate();

  const authUser = c.get('user') as { sub?: string; id?: string } | undefined;
  const userId = authUser?.sub ?? authUser?.id;
  if (userId) {
    void writeAuditLog({
      userId,
      action: 'delete',
      resource: 'enquiry',
      resourceId: id,
      details: { name: enquiry.name, phone: enquiry.phone },
      ip: c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip'),
      userAgent: c.req.header('user-agent'),
    });
  }

  return c.json({ success: true, data: { message: 'Enquiry deleted' } });
});

export default enquiries;
