import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { LeaveApplication } from '../models/leaveApplication.js';
import { AttendanceRecord } from '../models/attendanceRecord.js';
import { Tenant } from '../models/tenant.js';
import { User } from '../models/user.js';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { parsePagination, parseId, notFound, badRequest, safeFilter } from '../lib/routeUtils.js';
import { requireFeature } from '../middleware/featureFlags.js';

/** Inclusive YYYY-MM-DD range as calendar strings (no timezone shift). */
function eachDateInclusive(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return dates;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Mark attendance as on_leave for each day of an approved leave.
 * Skips days already present with a check-in (tenant was on-site).
 * Updates absent / not_returned / bare present-without-checkIn; upserts missing rows.
 */
async function markAttendanceOnLeave(
  tenantId: string,
  fromDate: string,
  toDate: string,
  adminId: string,
): Promise<void> {
  for (const date of eachDateInclusive(fromDate, toDate)) {
    const existing = await AttendanceRecord.findOne(safeFilter({ tenantId, date })).lean();
    const row = existing as { status?: string; checkIn?: unknown } | null;
    // Do not overwrite a real on-site present record
    if (row?.status === 'present' && row.checkIn) {
      continue;
    }

    try {
      // Cast update: Mongoose 9 strict typing rejects string ObjectId fields on $set
      await (AttendanceRecord.findOneAndUpdate as (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => Promise<unknown>)(
        safeFilter({ tenantId, date }),
        {
          $set: {
            status: 'on_leave',
            method: 'manual',
            notes: 'Leave approved',
            recordedBy: adminId,
          },
          $setOnInsert: {
            tenantId,
            date,
            checkIn: null,
            checkOut: null,
          },
        },
        { upsert: true, runValidators: true },
      );
    } catch (err: unknown) {
      // Concurrent write on unique tenantId+date — leave as-is
      if ((err as { code?: number }).code === 11000) continue;
      throw err;
    }
  }
}

// ── Cast helpers for Mongoose 9 ─────────────────────────
type CreateOneFn = (doc: Record<string, unknown>) => Promise<unknown>;
const leaveCreate = LeaveApplication.create.bind(LeaveApplication) as unknown as CreateOneFn;

// ── Zod Schemas ──────────────────────────────────────────

const createLeaveSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

// ── Helper: map lean doc to frontend-friendly shape ─────
function mapLeave(doc: Record<string, unknown>) {
  const tenant = doc.tenantId as Record<string, unknown> | undefined;
  const tenantUser = tenant?.userId as Record<string, unknown> | undefined;
  const room = tenant?.roomId as Record<string, unknown> | undefined;
  const approver = doc.approvedBy as Record<string, unknown> | undefined;

  return {
    ...doc,
    tenant: tenant
      ? {
          _id: String(tenant._id ?? ''),
          user: tenantUser
            ? {
                _id: String(tenantUser._id ?? ''),
                name: tenantUser.name,
                email: tenantUser.email,
                phone: tenantUser.phone,
              }
            : null,
          room: room ? { _id: String(room._id ?? ''), roomNumber: room.roomNumber } : null,
        }
      : null,
    startDate: doc.fromDate,
    endDate: doc.toDate,
    approvedByName: approver?.name ?? null,
  };
}

// ── Router ───────────────────────────────────────────────
// FLAG-leaves: nav couples Leaves to attendanceEnabled; gate API the same way.

const leaves = new Hono();
leaves.use('*', requireFeature('attendanceEnabled'));

// ── POST /leaves — create leave application ─────────────
leaves.post('/', authGuard, zValidator('json', createLeaveSchema), async (c) => {
  const body = c.req.valid('json');
  const authUser = c.get('user');

  // Validate tenant exists and is active
  const tenant = await Tenant.findById(body.tenantId).lean();
  if (!tenant) return badRequest(c, 'Tenant not found', 'TENANT_NOT_FOUND');
  if (!(tenant as unknown as Record<string, unknown>).isActive) {
    return badRequest(c, 'Tenant is not active', 'TENANT_INACTIVE');
  }

  // Check for overlapping leave applications
  const existingOverlap = await LeaveApplication.findOne(
    safeFilter({
      tenantId: body.tenantId,
      status: { $in: ['pending', 'approved'] },
      $or: [{ fromDate: { $lte: body.toDate }, toDate: { $gte: body.fromDate } }],
    }),
  );
  if (existingOverlap) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OVERLAPPING_LEAVE',
          message: `You already have a ${existingOverlap.status} leave from ${existingOverlap.fromDate} to ${existingOverlap.toDate}. Please cancel it first before creating a new one.`,
        },
      },
      409,
    );
  }

  // If user is a tenant, they can only create leaves for themselves
  if (authUser?.role === 'tenant') {
    const tenantUserId = (
      tenant as unknown as { userId: { toString: () => string } }
    ).userId.toString();
    if (tenantUserId !== authUser.sub) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only create leave applications for yourself.',
          },
        },
        403,
      );
    }
  }

  const leave = await leaveCreate({
    ...body,
    status: 'pending',
  });

  return c.json({ success: true, data: leave }, 201);
});

// ── GET /leaves — paginated list (admin) ────────────────
leaves.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit } = parsePagination(c);
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');
  const search = c.req.query('search')?.trim();

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (tenantId) filter.tenantId = tenantId;

  // Resolve search by tenant name (same pattern as meals feedback / tenants)
  if (search) {
    const users = await User.find(safeFilter({ name: { $regex: search, $options: 'i' } }))
      .select('_id')
      .lean();
    const userIds = users.map((u) => u._id);

    if (userIds.length === 0) {
      return c.json({
        success: true,
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      });
    }

    const tenants = await Tenant.find(safeFilter({ userId: { $in: userIds } }))
      .select('_id')
      .lean();
    const tenantIds = tenants.map((t) => String(t._id));

    if (tenantIds.length === 0) {
      return c.json({
        success: true,
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      });
    }

    if (tenantId) {
      if (!tenantIds.includes(tenantId)) {
        return c.json({
          success: true,
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        });
      }
      filter.tenantId = tenantId;
    } else {
      filter.tenantId = { $in: tenantIds };
    }
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    LeaveApplication.find(safeFilter(filter))
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'tenantId',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .populate({
        path: 'tenantId',
        populate: { path: 'roomId', select: 'roomNumber' },
      })
      .populate('approvedBy', 'name')
      .lean(),
    LeaveApplication.countDocuments(safeFilter(filter)),
  ]);

  const mapped = (data as unknown[]).map((doc) => mapLeave(doc as Record<string, unknown>));

  return c.json({
    success: true,
    data: mapped,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /leaves/my — tenant's own applications ──────────
leaves.get('/my', authGuard, async (c) => {
  const authUser = c.get('user');
  const { page, limit } = parsePagination(c);

  const tenant = await Tenant.findOne(safeFilter({ userId: authUser.sub })).lean();
  if (!tenant) {
    return c.json({ success: true, data: [], meta: { total: 0, page: 1, limit, totalPages: 0 } });
  }

  const tenantId = (tenant as unknown as Record<string, unknown>)._id?.toString();
  const skip = (page - 1) * limit;

  const filter = safeFilter({ tenantId });

  const [data, total] = await Promise.all([
    LeaveApplication.find(filter)
      .sort({ createdAt: -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .lean(),
    LeaveApplication.countDocuments(filter),
  ]);

  const mapped = (data as unknown[]).map((doc) => {
    const d = doc as Record<string, unknown>;
    return { ...d, startDate: d.fromDate, endDate: d.toDate };
  });

  return c.json({
    success: true,
    data: mapped,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /leaves/:id — single leave application ──────────
leaves.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid leave ID');

  const leave = await LeaveApplication.findById(id)
    .populate({
      path: 'tenantId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate({
      path: 'tenantId',
      populate: { path: 'roomId', select: 'roomNumber' },
    })
    .populate('approvedBy', 'name')
    .lean();

  if (!leave) return notFound(c, 'Leave application');

  return c.json({ success: true, data: mapLeave(leave as unknown as Record<string, unknown>) });
});

// ── POST /leaves/:id/cancel — tenant owner or admin withdraws pending leave
leaves.post('/:id/cancel', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid leave ID');

  const authUser = c.get('user');
  const leave = await LeaveApplication.findById(id);
  if (!leave) return notFound(c, 'Leave application');
  if (leave.status !== 'pending') {
    return c.json(
      {
        success: false,
        error: {
          code: 'LEAVE_NOT_PENDING',
          message: `Only pending leaves can be cancelled (current: ${leave.status}).`,
        },
      },
      400,
    );
  }

  if (authUser.role === 'tenant') {
    const tenant = await Tenant.findOne(safeFilter({ userId: authUser.sub })).lean();
    if (!tenant || String((tenant as { _id: unknown })._id) !== String(leave.tenantId)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only cancel your own leave applications.' },
        },
        403,
      );
    }
  } else if (authUser.role !== 'admin') {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not allowed to cancel leaves.' } },
      403,
    );
  }

  leave.status = 'cancelled';
  await leave.save();

  const updated = await LeaveApplication.findById(id)
    .populate({
      path: 'tenantId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate({
      path: 'tenantId',
      populate: { path: 'roomId', select: 'roomNumber' },
    })
    .lean();

  return c.json({
    success: true,
    data: mapLeave(updated as unknown as Record<string, unknown>),
  });
});

// ── DELETE /leaves/:id — admin hard-deletes pending leave ────
leaves.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid leave ID');

  const leave = await LeaveApplication.findById(id);
  if (!leave) return notFound(c, 'Leave application');
  if (leave.status !== 'pending' && leave.status !== 'cancelled') {
    return badRequest(c, `Leave is already ${leave.status}`, 'LEAVE_NOT_PENDING');
  }

  await LeaveApplication.findByIdAndDelete(id);

  return c.json({ success: true, data: { message: 'Leave application deleted' } });
});

// ── PUT /leaves/:id/approve — admin approves ───────────
leaves.put('/:id/approve', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid leave ID');

  const authUser = c.get('user');

  const leave = await LeaveApplication.findById(id);
  if (!leave) return notFound(c, 'Leave application');
  if (leave.status !== 'pending') {
    return badRequest(c, `Leave is already ${leave.status}`, 'LEAVE_NOT_PENDING');
  }

  leave.status = 'approved';
  (leave as unknown as Record<string, unknown>).approvedBy = authUser.sub;
  leave.approvedAt = new Date();
  await leave.save();

  // Side-effect: mark each leave day as on_leave on the attendance board
  await markAttendanceOnLeave(
    String(leave.tenantId),
    leave.fromDate,
    leave.toDate,
    authUser.sub,
  );

  const updated = await LeaveApplication.findById(id)
    .populate({
      path: 'tenantId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate({
      path: 'tenantId',
      populate: { path: 'roomId', select: 'roomNumber' },
    })
    .populate('approvedBy', 'name')
    .lean();

  return c.json({ success: true, data: mapLeave(updated as unknown as Record<string, unknown>) });
});

// ── PUT /leaves/:id/reject — admin rejects ─────────────
leaves.put(
  '/:id/reject',
  authGuard,
  adminOnly,
  zValidator(
    'json',
    z.strictObject({
      adminNotes: z.string().max(500).optional(),
    }),
  ),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid leave ID');

    const authUser = c.get('user');
    const body = c.req.valid('json');

    const leave = await LeaveApplication.findById(id);
    if (!leave) return notFound(c, 'Leave application');
    if (leave.status !== 'pending') {
      return badRequest(c, `Leave is already ${leave.status}`, 'LEAVE_NOT_PENDING');
    }

    leave.status = 'rejected';
    (leave as unknown as Record<string, unknown>).approvedBy = authUser.sub;
    leave.approvedAt = new Date();

    if (body.adminNotes) {
      leave.adminNotes = body.adminNotes;
    }

    await leave.save();

    const updated = await LeaveApplication.findById(id)
      .populate({
        path: 'tenantId',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .populate({
        path: 'tenantId',
        populate: { path: 'roomId', select: 'roomNumber' },
      })
      .populate('approvedBy', 'name')
      .lean();

    return c.json({ success: true, data: mapLeave(updated as unknown as Record<string, unknown>) });
  },
);

export default leaves;
