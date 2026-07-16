import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { LaundrySlot } from '../models/laundrySlot.js';
import { requireFeature } from '../middleware/featureFlags.js';

const laundry = new Hono();

// Feature gate for all laundry routes
laundry.use('*', requireFeature('laundryEnabled'));

// ── Schemas ─────────────────────────────────────────────
const createSlotSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant is required'),
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  items: z.number().int().min(1, 'At least 1 item').optional(),
  notes: z.string().max(300).optional(),
});

const updateSlotSchema = z.strictObject({
  status: z.enum(['booked', 'confirmed', 'completed', 'cancelled']).optional(),
  slotDate: z.string().min(1).optional(),
  slotTime: z.string().min(1).optional(),
  items: z.number().int().min(1).optional(),
  notes: z.string().max(300).optional(),
});

/** Map lean slot so FE list/detail can use tenant.user / tenant.room. */
function mapLaundrySlot(doc: Record<string, unknown>) {
  const tenantRaw = doc.tenantId;
  const tenant =
    tenantRaw && typeof tenantRaw === 'object'
      ? (tenantRaw as Record<string, unknown>)
      : undefined;
  const userRaw = tenant?.userId;
  const user =
    userRaw && typeof userRaw === 'object' ? (userRaw as Record<string, unknown>) : undefined;
  const roomRaw = tenant?.roomId;
  const room =
    roomRaw && typeof roomRaw === 'object' ? (roomRaw as Record<string, unknown>) : undefined;

  return {
    ...doc,
    // Keep populated tenantId for edit forms; also expose flat tenant for list/detail
    tenant: tenant
      ? {
          _id: String(tenant._id ?? ''),
          user: user
            ? { name: user.name as string, phone: user.phone as string | undefined }
            : undefined,
          room: room ? { roomNumber: room.roomNumber as string } : undefined,
          bedId: tenant.bedId as string | undefined,
        }
      : undefined,
  };
}

// ── GET /laundry-slots ──────────────────────────────────
laundry.get('/', authGuard, async (c) => {
  const user = c.get('user');

  // Tenants see only their own slots
  if (user.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub })).lean();
    if (!tenant) return c.json({ success: true, data: [] });
    const data = await LaundrySlot.find(safeFilter({ tenantId: tenant._id }))
      .sort({ slotDate: -1, slotTime: -1 })
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
      .lean();
    return c.json({
      success: true,
      data: (data as unknown as Record<string, unknown>[]).map(mapLaundrySlot),
    });
  }

  // Admins see all — with pagination and status filter
  const status = c.req.query('status');
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    LaundrySlot.find(filter)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
      .lean(),
    LaundrySlot.countDocuments(filter),
  ]);

  return c.json({
    success: true,
    data: (data as unknown as Record<string, unknown>[]).map(mapLaundrySlot),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /laundry-slots/:id ──────────────────────────────
laundry.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid slot ID');

  const slot = await LaundrySlot.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name phone' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .lean();
  if (!slot) return notFound(c, 'Laundry slot');

  return c.json({
    success: true,
    data: mapLaundrySlot(slot as unknown as Record<string, unknown>),
  });
});

// ── POST /laundry-slots ─────────────────────────────────
laundry.post('/', authGuard, zValidator('json', createSlotSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  // If tenant, force their own tenantId
  if (user.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub })).lean();
    if (!tenant) return badRequest(c, 'No tenant profile found', 'TENANT_REQUIRED');
    body.tenantId = String((tenant as unknown as Record<string, unknown>)._id);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slot: any = await LaundrySlot.create(body as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const populated = await LaundrySlot.findById(String((slot as any)._id))
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
      .lean();

    return c.json(
      {
        success: true,
        data: mapLaundrySlot(populated as unknown as Record<string, unknown>),
      },
      201,
    );
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return c.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_SLOT',
            message: 'A laundry slot is already booked for this date and time.',
          },
        },
        409,
      );
    }
    throw err;
  }
});

// ── PUT /laundry-slots/:id ──────────────────────────────
laundry.put('/:id', authGuard, adminOnly, zValidator('json', updateSlotSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid slot ID');

  const body = c.req.valid('json');
  const slot = await LaundrySlot.findById(id);
  if (!slot) return notFound(c, 'Laundry slot');

  // ── Duplicate check: tenantId + slotDate + slotTime ──
  if (body.slotDate !== undefined || body.slotTime !== undefined) {
    const checkDate = body.slotDate ?? slot.slotDate;
    const checkTime = body.slotTime ?? slot.slotTime;
    const exists = await LaundrySlot.findOne(
      safeFilter({
        tenantId: slot.tenantId,
        slotDate: checkDate,
        slotTime: checkTime,
        _id: { $ne: slot._id },
      }),
    );
    if (exists) {
      return c.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_SLOT',
            message: 'A laundry slot already exists for this tenant, date and time.',
          },
        },
        409,
      );
    }
  }

  if (body.status !== undefined) slot.status = body.status;
  if (body.slotDate !== undefined) slot.slotDate = body.slotDate;
  if (body.slotTime !== undefined) slot.slotTime = body.slotTime;
  if (body.items !== undefined) slot.items = body.items;
  if (body.notes !== undefined) slot.notes = body.notes;

  await slot.save();

  const populated = await LaundrySlot.findById(slot._id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .lean();

  return c.json({
    success: true,
    data: mapLaundrySlot(populated as unknown as Record<string, unknown>),
  });
});

// ── DELETE /laundry-slots/:id ───────────────────────────
laundry.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid slot ID');

  const slot = await LaundrySlot.findByIdAndDelete(id);
  if (!slot) return notFound(c, 'Laundry slot');
  return c.json({ success: true, data: { message: 'Laundry slot deleted' } });
});

export default laundry;
