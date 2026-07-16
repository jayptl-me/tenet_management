import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { complaintStatusPatch, type ComplaintStatus } from '../lib/complaint-status.js';
import { Complaint } from '../models/complaint.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';

const complaints = new Hono();

// ── Schemas ─────────────────────────────────────────────
const photoUrlSchema = z
  .string()
  .url('Photo must be a valid URL')
  .max(2048, 'Photo URL too long');

const createComplaintSchema = z.strictObject({
  /** Required when an admin files on behalf of a tenant. Ignored for tenant role. */
  tenantId: z.string().min(1).optional(),
  roomId: z.string().min(1, 'Room ID is required'),
  category: z.string().min(1, 'Category is required').max(50),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  /** Optional evidence image URLs (Cloudinary or external HTTPS). Max 5. */
  photos: z.array(photoUrlSchema).max(5, 'At most 5 photos').optional().default([]),
});

/** Map lean complaint so FE can use tenant.user / tenant.room consistently. */
function mapComplaint(doc: Record<string, unknown>) {
  const tenantRaw = doc.tenant;
  const tenant =
    tenantRaw && typeof tenantRaw === 'object'
      ? (tenantRaw as Record<string, unknown>)
      : undefined;
  const userRaw = tenant?.userId;
  const user =
    userRaw && typeof userRaw === 'object' ? (userRaw as Record<string, unknown>) : undefined;
  const roomFromTenant = tenant?.roomId;
  const roomNested =
    roomFromTenant && typeof roomFromTenant === 'object'
      ? (roomFromTenant as Record<string, unknown>)
      : undefined;
  const roomRaw = doc.room;
  const room =
    roomRaw && typeof roomRaw === 'object' ? (roomRaw as Record<string, unknown>) : undefined;

  return {
    ...doc,
    tenant: tenant
      ? {
          _id: String(tenant._id ?? ''),
          user: user
            ? {
                _id: String(user._id ?? ''),
                name: user.name,
                email: user.email,
                phone: user.phone,
              }
            : undefined,
          room: roomNested
            ? { _id: String(roomNested._id ?? ''), roomNumber: roomNested.roomNumber }
            : room
              ? { _id: String(room._id ?? ''), roomNumber: room.roomNumber }
              : undefined,
        }
      : undefined,
  };
}

const updateStatusSchema = z.strictObject({
  status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
  adminNotes: z.string().optional(),
});

const updateComplaintSchema = z.strictObject({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  category: z.string().min(1).max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']).optional(),
  adminNotes: z.string().max(2000).optional(),
  /** Replace full photo URL list (max 5). */
  photos: z.array(photoUrlSchema).max(5, 'At most 5 photos').optional(),
});

// ── GET /complaints/stats ───────────────────────────────
complaints.get('/stats', authGuard, adminOnly, async (c) => {
  const [statusCounts, categoryCounts] = await Promise.all([
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);

  const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, dismissed: 0 };
  for (const entry of statusCounts) {
    byStatus[entry._id as string] = entry.count;
  }

  const byCategory: Record<string, number> = {};
  for (const entry of categoryCounts) {
    byCategory[entry._id as string] = entry.count;
  }

  return c.json({
    success: true,
    data: { byStatus, byCategory },
  });
});

// ── GET /complaints/my ─────────────────────────────────
complaints.get('/my', authGuard, tenantOnly, async (c) => {
  const userId = c.get('user').sub;

  const tenant = await Tenant.findOne(safeFilter({ userId })).lean();
  if (!tenant) {
    return notFound(c, 'Tenant profile');
  }

  const data = await Complaint.find({ tenantId: tenant._id } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .populate('tenant', 'room')
    .lean();

  return c.json({ success: true, data });
});

// ── POST /complaints ────────────────────────────────────
complaints.post('/', authGuard, zValidator('json', createComplaintSchema), async (c) => {
  const body = c.req.valid('json');
  const authUser = c.get('user');
  const userId = authUser.sub;

  // Validate room exists
  const roomId = parseId(body.roomId);
  if (!roomId) return badRequest(c, 'Invalid room ID');

  const room = await Room.findById(roomId).lean();
  if (!room) return notFound(c, 'Room');

  // Resolve tenant: admin may pass tenantId; tenants always use their own profile
  let tenant: { _id: unknown };
  if (authUser.role === 'admin') {
    if (!body.tenantId) {
      return badRequest(c, 'Tenant is required when filing a complaint as admin.', 'TENANT_REQUIRED');
    }
    const tid = parseId(body.tenantId);
    if (!tid) return badRequest(c, 'Invalid tenant ID');
    const adminTenant = await Tenant.findById(tid).lean();
    if (!adminTenant) return notFound(c, 'Tenant');
    tenant = adminTenant;
  } else {
    const selfTenant = await Tenant.findOne(safeFilter({ userId })).lean();
    if (!selfTenant) {
      return badRequest(
        c,
        'No tenant profile found for this user. Only tenants can create complaints.',
        'TENANT_REQUIRED',
      );
    }
    tenant = selfTenant;
  }

  // Cooldown: prevent duplicate complaints in same category within 30 minutes
  const recentCount = await Complaint.countDocuments(
    safeFilter({
      tenantId: tenant._id,
      category: body.category,
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
    }),
  );
  if (recentCount > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'COMPLAINT_COOLDOWN',
          message:
            'You already submitted a complaint in this category recently. Please wait 30 minutes before filing another.',
        },
      },
      429,
    );
  }

  const complaint = await (
    Complaint as unknown as { create: (doc: Record<string, unknown>) => Promise<unknown> }
  ).create({
    tenantId: tenant._id,
    roomId,
    category: body.category,
    title: body.title,
    description: body.description,
    priority: body.priority,
    photos: body.photos ?? [],
  });

  return c.json({ success: true, data: complaint }, 201);
});

// ── GET /complaints ─────────────────────────────────────
complaints.get('/', authGuard, adminOnly, async (c) => {
  const filter: Record<string, unknown> = {};

  const status = c.req.query('status');
  if (status) filter.status = status;

  const category = c.req.query('category');
  if (category) filter.category = category;

  const priority = c.req.query('priority');
  if (priority) filter.priority = priority;

  const roomIdQ = c.req.query('roomId');
  if (roomIdQ) {
    const parsed = parseId(roomIdQ);
    if (!parsed) return badRequest(c, 'Invalid roomId');
    filter.roomId = parsed;
  }

  // Date range filtering
  const fromDate = c.req.query('fromDate');
  const toDate = c.req.query('toDate');
  if (fromDate || toDate) {
    const createdAtFilter: Record<string, unknown> = {};
    if (fromDate) createdAtFilter.$gte = new Date(fromDate);
    if (toDate) createdAtFilter.$lte = new Date(toDate);
    filter.createdAt = createdAtFilter;
  }

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    Complaint.find(filter as Record<string, unknown>)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'tenant', populate: { path: 'userId', select: 'name email phone' } },
        { path: 'tenant', populate: { path: 'roomId', select: 'roomNumber' } },
        { path: 'room', select: 'roomNumber' },
      ])
      .lean(),
    Complaint.countDocuments(filter as Record<string, unknown>),
  ]);

  return c.json({
    success: true,
    data: (data as unknown as Record<string, unknown>[]).map(mapComplaint),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /complaints/:id ─────────────────────────────────
complaints.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid complaint ID');

  const authUser = c.get('user');

  const complaint = await Complaint.findById(id)
    .populate([
      { path: 'tenant', populate: { path: 'userId', select: 'name email phone' } },
      { path: 'tenant', populate: { path: 'roomId', select: 'roomNumber' } },
      { path: 'room', select: 'roomNumber' },
    ])
    .lean();
  if (!complaint) return notFound(c, 'Complaint');

  // CMP-authz: tenants may only read their own complaints
  if (authUser.role === 'tenant') {
    const tenant = await Tenant.findOne({
      userId: authUser.sub,
      isActive: true,
    } as Record<string, unknown>)
      .select('_id')
      .lean();
    const complaintTenantId = String(
      (complaint as { tenantId?: unknown }).tenantId ??
        (complaint as { tenant?: { _id?: unknown } }).tenant?._id ??
        '',
    );
    if (!tenant || complaintTenantId !== String(tenant._id)) {
      return notFound(c, 'Complaint');
    }
  }

  return c.json({
    success: true,
    data: mapComplaint(complaint as unknown as Record<string, unknown>),
  });
});

// ── PUT /complaints/:id/status ──────────────────────────
complaints.put(
  '/:id/status',
  authGuard,
  adminOnly,
  zValidator('json', updateStatusSchema),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid complaint ID');

    const body = c.req.valid('json');

    const updateData: Record<string, unknown> = {
      ...complaintStatusPatch(body.status as ComplaintStatus),
    };

    if (body.adminNotes !== undefined) {
      updateData.adminNotes = body.adminNotes;
    }

    const complaint = await Complaint.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();

    if (!complaint) return notFound(c, 'Complaint');

    return c.json({ success: true, data: complaint });
  },
);

// ── POST /complaints/:id/photos — append photo URLs (tenant owner or admin)
// Body: { photos: string[] } HTTPS URLs (e.g. after client Cloudinary unsigned upload,
// or admin paste). Keeps contract honest without requiring multipart when CDN is unset.
const appendPhotosSchema = z.strictObject({
  photos: z.array(photoUrlSchema).min(1).max(5),
});

complaints.post(
  '/:id/photos',
  authGuard,
  zValidator('json', appendPhotosSchema),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid complaint ID');

    const authUser = c.get('user');
    const body = c.req.valid('json');

    const complaint = await Complaint.findById(id);
    if (!complaint) return notFound(c, 'Complaint');

    if (authUser.role === 'tenant') {
      const tenant = await Tenant.findOne(safeFilter({ userId: authUser.sub })).lean();
      if (!tenant || String((tenant as { _id: unknown })._id) !== String(complaint.tenantId)) {
        return c.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'You can only attach photos to your complaints.' },
          },
          403,
        );
      }
    } else if (authUser.role !== 'admin') {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not allowed.' } },
        403,
      );
    }

    const existing = Array.isArray(complaint.photos) ? complaint.photos : [];
    const merged = [...existing, ...body.photos].slice(0, 5);
    complaint.photos = merged;
    await complaint.save();

    return c.json({ success: true, data: complaint });
  },
);

// ── PUT /complaints/:id — full admin edit ────────────────
complaints.put(
  '/:id',
  authGuard,
  adminOnly,
  zValidator('json', updateComplaintSchema),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid complaint ID');

    const body = c.req.valid('json');
    const updateData: Record<string, unknown> = { ...body };

    if (body.status !== undefined) {
      Object.assign(updateData, complaintStatusPatch(body.status as ComplaintStatus));
    }

    const complaint = await Complaint.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();

    if (!complaint) return notFound(c, 'Complaint');

    return c.json({ success: true, data: complaint });
  },
);

// ── DELETE /complaints/:id ───────────────────────────────
complaints.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid complaint ID');

  const complaint = await Complaint.findByIdAndDelete(id);
  if (!complaint) return notFound(c, 'Complaint');

  return c.json({ success: true, data: { message: 'Complaint deleted' } });
});

export default complaints;
