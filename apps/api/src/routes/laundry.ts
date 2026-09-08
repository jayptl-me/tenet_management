import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
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
    tenantRaw && typeof tenantRaw === 'object' ? (tenantRaw as Record<string, unknown>) : undefined;
  const userRaw = tenant?.userId;
  const user =
    userRaw && typeof userRaw === 'object' ? (userRaw as Record<string, unknown>) : undefined;
  const roomRaw = tenant?.roomId;
  const room =
    roomRaw && typeof roomRaw === 'object' ? (roomRaw as Record<string, unknown>) : undefined;
  const roomFloor = room?.floor as Record<string, unknown> | undefined;

  return {
    ...doc,
    // Keep populated tenantId for edit forms; also expose flat tenant for list/detail
    tenant: tenant
      ? {
          _id: String(tenant._id ?? ''),
          user: user
            ? { name: user.name as string, phone: user.phone as string | undefined }
            : undefined,
          room: room
            ? {
                roomNumber: room.roomNumber as string,
                floor:
                  roomFloor && typeof roomFloor === 'object' && 'label' in roomFloor
                    ? {
                        _id: String(roomFloor._id ?? ''),
                        label: roomFloor.label,
                        floorNumber: roomFloor.floorNumber,
                      }
                    : null,
              }
            : undefined,
          bedId: tenant.bedId as string | undefined,
        }
      : undefined,
  };
}

// ── GET /laundry-slots ──────────────────────────────────
laundry.get('/', authGuard, async (c) => {
  const user = c.get('user');

  // Tenants see only their own slots (same shape + meta contract as admin)
  if (user.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub })).lean();
    if (!tenant) {
      return c.json({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 25, totalPages: 0 },
      });
    }
    const tenantFilter = safeFilter({ tenantId: tenant._id });
    const statusQ = c.req.query('status');
    if (statusQ) {
      if (!['booked', 'confirmed', 'completed', 'cancelled'].includes(statusQ)) {
        return badRequest(c, 'Invalid status filter', 'INVALID_STATUS');
      }
      (tenantFilter as Record<string, unknown>).status = statusQ;
    }
    const { page, limit, skip } = parsePagination(c);
    const [data, total] = await Promise.all([
      LaundrySlot.find(tenantFilter)
        .sort({ slotDate: -1, slotTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
        .populate({
          path: 'tenantId',
          populate: {
            path: 'roomId',
            select: 'roomNumber floor',
            populate: { path: 'floor', select: 'label floorNumber' },
          },
        })
        .lean(),
      LaundrySlot.countDocuments(tenantFilter),
    ]);
    return c.json({
      success: true,
      data: (data as unknown as Record<string, unknown>[]).map(mapLaundrySlot),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  }

  // Admins see all — with pagination and filters
  const status = c.req.query('status');
  const slotDate = c.req.query('slotDate');
  const tenantId = c.req.query('tenantId');
  const filter: Record<string, unknown> = {};
  if (status) {
    if (!['booked', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return badRequest(c, 'Invalid status filter', 'INVALID_STATUS');
    }
    filter.status = status;
  }
  if (slotDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)) {
      return badRequest(c, 'slotDate must be YYYY-MM-DD', 'INVALID_DATE');
    }
    filter.slotDate = slotDate;
  }
  if (tenantId) {
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return badRequest(c, 'Invalid tenantId', 'INVALID_TENANT');
    }
    filter.tenantId = new mongoose.Types.ObjectId(tenantId);
  }

  const pagination = parsePagination(c);
  const { sort, order, skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    LaundrySlot.find(filter)
      .sort({ [sort]: order === 'asc' ? 1 : -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
      .populate({
        path: 'tenantId',
        populate: {
          path: 'roomId',
          select: 'roomNumber floor',
          populate: { path: 'floor', select: 'label floorNumber' },
        },
      })
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
    .populate({
      path: 'tenantId',
      populate: {
        path: 'roomId',
        select: 'roomNumber floor',
        populate: { path: 'floor', select: 'label floorNumber' },
      },
    })
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

  const today = new Date().toISOString().slice(0, 10);
  if (body.slotDate < today) {
    return badRequest(c, 'Cannot book laundry slots for past dates', 'INVALID_SLOT_DATE');
  }

  // Facility-wide capacity limit per slot time (max 5 active bookings per slot)
  const MAX_CONCURRENT_SLOTS = 5;
  const activeCount = await LaundrySlot.countDocuments({
    slotDate: body.slotDate,
    slotTime: body.slotTime,
    status: { $nin: ['cancelled'] },
  });
  if (activeCount >= MAX_CONCURRENT_SLOTS) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SLOT_FULL',
          message: 'This laundry slot time has reached maximum facility capacity.',
        },
      },
      409,
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slot: any = await LaundrySlot.create(body as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const populated = await LaundrySlot.findById(String((slot as any)._id))
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
      .populate({
        path: 'tenantId',
        populate: {
          path: 'roomId',
          select: 'roomNumber floor',
          populate: { path: 'floor', select: 'label floorNumber' },
        },
      })
      .lean();

    try {
      const { writeAuditLog } = await import('../lib/write-audit-log.js');
      await writeAuditLog({
        userId: user.sub,
        action: 'create',
        resource: 'laundry_slot',
        resourceId: String((slot as { _id: unknown })._id),
        details: { slotDate: body.slotDate, slotTime: body.slotTime, items: body.items },
        ip: c.req.header('x-forwarded-for') || undefined,
        userAgent: c.req.header('user-agent') || undefined,
      });
    } catch {
      // Non-blocking audit log
    }

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

  // Terminal states can only reopen to booked; all other moves are free.
  if (body.status !== undefined && body.status !== slot.status) {
    const from = slot.status;
    if ((from === 'completed' || from === 'cancelled') && body.status !== 'booked') {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot move a ${from} slot to ${body.status}. Reopen to booked first.`,
          },
        },
        409,
      );
    }
  }

  // Past-date guard mirrors create: rescheduling into the past is rejected.
  const nextDate = body.slotDate ?? slot.slotDate;
  const today = new Date().toISOString().slice(0, 10);
  if (nextDate < today) {
    return badRequest(c, 'Cannot move a laundry slot to a past date', 'INVALID_SLOT_DATE');
  }

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

  try {
    const { writeAuditLog } = await import('../lib/write-audit-log.js');
    await writeAuditLog({
      userId: (c.get('user') as { sub?: string } | undefined)?.sub ?? 'system',
      action: 'update',
      resource: 'laundry_slot',
      resourceId: String(slot._id),
      details: { status: slot.status, slotDate: slot.slotDate, slotTime: slot.slotTime },
      ip: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    });
  } catch {
    // Non-blocking audit log
  }

  const populated = await LaundrySlot.findById(slot._id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
    .populate({
      path: 'tenantId',
      populate: {
        path: 'roomId',
        select: 'roomNumber floor',
        populate: { path: 'floor', select: 'label floorNumber' },
      },
    })
    .lean();

  return c.json({
    success: true,
    data: mapLaundrySlot(populated as unknown as Record<string, unknown>),
  });
});

// ── POST /laundry-slots/:id/cancel ──────────────────────────
laundry.post('/:id/cancel', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid slot ID');

  const authUser = c.get('user');
  const slot = await LaundrySlot.findById(id);
  if (!slot) return notFound(c, 'Laundry slot');

  if (slot.status === 'cancelled') {
    return c.json(
      {
        success: false,
        error: {
          code: 'SLOT_ALREADY_CANCELLED',
          message: 'This laundry slot is already cancelled.',
        },
      },
      400,
    );
  }

  if (slot.status === 'completed') {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Completed laundry slots cannot be cancelled.',
        },
      },
      400,
    );
  }

  if (authUser.role === 'tenant') {
    const { Tenant } = await import('../models/tenant.js');
    const tenant = await Tenant.findOne(safeFilter({ userId: authUser.sub })).lean();
    if (!tenant || String((tenant as { _id: unknown })._id) !== String(slot.tenantId)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only cancel your own laundry slots.' },
        },
        403,
      );
    }
  } else if (authUser.role !== 'admin') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not allowed to cancel laundry slots.' },
      },
      403,
    );
  }

  slot.status = 'cancelled';
  await slot.save();

  try {
    const { writeAuditLog } = await import('../lib/write-audit-log.js');
    await writeAuditLog({
      userId: authUser.sub,
      action: 'update',
      resource: 'laundry_slot',
      resourceId: String(slot._id),
      details: { status: 'cancelled', cancelledBy: authUser.role },
      ip: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    });
  } catch {
    // Non-blocking audit log
  }

  const populated = await LaundrySlot.findById(slot._id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
    .populate({
      path: 'tenantId',
      populate: {
        path: 'roomId',
        select: 'roomNumber floor',
        populate: { path: 'floor', select: 'label floorNumber' },
      },
    })
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

  try {
    const { writeAuditLog } = await import('../lib/write-audit-log.js');
    await writeAuditLog({
      userId: (c.get('user') as { sub?: string } | undefined)?.sub ?? 'system',
      action: 'delete',
      resource: 'laundry_slot',
      resourceId: String(slot._id),
      details: { slotDate: slot.slotDate, slotTime: slot.slotTime, status: slot.status },
      ip: c.req.header('x-forwarded-for') || undefined,
      userAgent: c.req.header('user-agent') || undefined,
    });
  } catch {
    // Non-blocking audit log
  }

  return c.json({ success: true, data: { message: 'Laundry slot deleted' } });
});

export default laundry;
