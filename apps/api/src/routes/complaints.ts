import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly, tenantOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { Complaint } from '../models/complaint.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';

const complaints = new Hono();

// ── Schemas ─────────────────────────────────────────────
const createComplaintSchema = z.strictObject({
  roomId: z.string().min(1, 'Room ID is required'),
  category: z.enum([
    'wifi',
    'water',
    'electricity',
    'food_quality',
    'cleaning_room',
    'cleaning_washroom',
    'washing_machine',
    'fridge',
    'lights',
    'noise',
    'other',
  ]),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

const updateStatusSchema = z.strictObject({
  status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
  adminNotes: z.string().optional(),
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
  const userId = c.get('user').sub;

  // Validate room exists
  const roomId = parseId(body.roomId);
  if (!roomId) return badRequest(c, 'Invalid room ID');

  const room = await Room.findById(roomId).lean();
  if (!room) return notFound(c, 'Room');

  // Find tenant doc for this user
  const tenant = await Tenant.findOne(safeFilter({ userId })).lean();
  if (!tenant) {
    return badRequest(
      c,
      'No tenant profile found for this user. Only tenants can create complaints.',
      'TENANT_REQUIRED',
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
      .populate('tenant')
      .populate('room')
      .lean(),
    Complaint.countDocuments(filter as Record<string, unknown>),
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

// ── GET /complaints/:id ─────────────────────────────────
complaints.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid complaint ID');

  const complaint = await Complaint.findById(id).populate('tenant').populate('room').lean();
  if (!complaint) return notFound(c, 'Complaint');

  return c.json({ success: true, data: complaint });
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
      status: body.status,
    };

    if (body.adminNotes !== undefined) {
      updateData.adminNotes = body.adminNotes;
    }

    if (body.status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const complaint = await Complaint.findByIdAndUpdate(id, updateData, {
      new: true,
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
