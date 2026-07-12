import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AttendanceRecord } from '../models/attendanceRecord.js';
import { Tenant } from '../models/tenant.js';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { parsePagination, parseId, notFound, badRequest, safeFilter } from '../lib/routeUtils.js';
import { requireFeature } from '../middleware/featureFlags.js';

// ── Cast helpers for Mongoose 9 ─────────────────────────
type CreateOneFn = (doc: Record<string, unknown>) => Promise<unknown>;
const attendanceCreate = AttendanceRecord.create as unknown as CreateOneFn;

// ── Zod Schemas ──────────────────────────────────────────

const checkInSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  method: z.enum(['manual', 'qr', 'app']).default('app'),
});

const checkOutSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
});

const manualSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum(['present', 'absent', 'on_leave', 'not_returned']),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  method: z.enum(['manual', 'qr', 'app']).default('manual'),
  notes: z.string().max(500).optional(),
});

// ── Helper: get today's date string in YYYY-MM-DD ───────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Helper: map lean doc to frontend-friendly shape ─────
function mapRecord(doc: Record<string, unknown>) {
  const tenant = doc.tenantId as Record<string, unknown> | undefined;
  const tenantUser = tenant?.userId as Record<string, unknown> | undefined;
  const room = tenant?.roomId as Record<string, unknown> | undefined;
  const recordedBy = doc.recordedBy as Record<string, unknown> | undefined;

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
    checkInTime: doc.checkIn,
    checkOutTime: doc.checkOut,
    recordedBy: recordedBy ? { _id: String(recordedBy._id ?? ''), name: recordedBy.name } : null,
  };
}

// ── Router ───────────────────────────────────────────────

const attendance = new Hono();
attendance.use('*', requireFeature('attendanceEnabled'));

// ── POST /attendance/check-in — tenant self check-in ────
attendance.post('/check-in', authGuard, zValidator('json', checkInSchema), async (c) => {
  const body = c.req.valid('json');
  const authUser = c.get('user');

  const tenant = await Tenant.findById(body.tenantId).lean();
  if (!tenant) return badRequest(c, 'Tenant not found', 'TENANT_NOT_FOUND');

  // If tenant self, enforce they can only check-in themselves
  if (authUser?.role === 'tenant') {
    const tenantUserId = (
      tenant as unknown as { userId: { toString: () => string } }
    ).userId.toString();
    if (tenantUserId !== authUser.sub) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only check-in yourself.' },
        },
        403,
      );
    }
  }

  const date = today();

  // Check-in window: 5 AM to 11 PM server time
  const currentHour = new Date().getHours();
  if (currentHour < 5 || currentHour >= 23) {
    return c.json(
      {
        success: false,
        error: {
          code: 'CHECKIN_WINDOW_CLOSED',
          message: 'Check-in is only available between 5 AM and 11 PM.',
        },
      },
      400,
    );
  }

  // Check if already recorded today
  const existing = await AttendanceRecord.findOne(safeFilter({ tenantId: body.tenantId, date }));
  if (existing) {
    return badRequest(c, 'Attendance already recorded for today', 'ALREADY_RECORDED');
  }

  try {
    const record = await attendanceCreate({
      tenantId: body.tenantId,
      date,
      checkIn: new Date(),
      checkOut: null,
      status: 'present',
      method: body.method,
      recordedBy: authUser?.role === 'admin' ? authUser.sub : null,
    });

    return c.json(
      { success: true, data: mapRecord(record as unknown as Record<string, unknown>) },
      201,
    );
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return badRequest(c, 'Attendance already recorded for today (concurrent request).', 'ALREADY_RECORDED');
    }
    throw err;
  }
});

// ── POST /attendance/check-out — tenant self check-out ──
attendance.post('/check-out', authGuard, zValidator('json', checkOutSchema), async (c) => {
  const body = c.req.valid('json');
  const date = today();

  const record = await AttendanceRecord.findOne(safeFilter({ tenantId: body.tenantId, date }));

  if (!record) {
    return badRequest(
      c,
      'No check-in record found for today. Please check-in first.',
      'NO_CHECKIN',
    );
  }

  if (record.checkOut) {
    return badRequest(c, 'Already checked out for today', 'ALREADY_CHECKED_OUT');
  }

  record.checkOut = new Date();
  record.status = 'present';
  await record.save();

  const updated = await AttendanceRecord.findById(record._id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .populate('recordedBy', 'name')
    .lean();

  return c.json({ success: true, data: mapRecord(updated as unknown as Record<string, unknown>) });
});

// ── POST /attendance/manual — admin manual marking ──────
attendance.post('/manual', authGuard, adminOnly, zValidator('json', manualSchema), async (c) => {
  const body = c.req.valid('json');
  const authUser = c.get('user');

  const tenant = await Tenant.findById(body.tenantId).lean();
  if (!tenant) return badRequest(c, 'Tenant not found', 'TENANT_NOT_FOUND');

  // Check if already recorded for this date
  const existing = await AttendanceRecord.findOne(
    safeFilter({ tenantId: body.tenantId, date: body.date }),
  );
  if (existing) {
    return badRequest(c, 'Attendance already recorded for this date', 'ALREADY_RECORDED');
  }

  const record = await attendanceCreate({
    tenantId: body.tenantId,
    date: body.date,
    checkIn: body.checkIn ? new Date(`${body.date}T${body.checkIn}:00`) : null,
    checkOut: body.checkOut ? new Date(`${body.date}T${body.checkOut}:00`) : null,
    status: body.status,
    method: body.method,
    notes: body.notes ?? '',
    recordedBy: authUser.sub,
  });

  return c.json(
    { success: true, data: mapRecord(record as unknown as Record<string, unknown>) },
    201,
  );
});

// ── GET /attendance — admin paginated list ──────────────
attendance.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit } = parsePagination(c);
  const status = c.req.query('status');
  const date = c.req.query('date');
  const tenantId = c.req.query('tenantId');

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (date) filter.date = date;
  if (tenantId) filter.tenantId = tenantId;

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    AttendanceRecord.find(safeFilter(filter))
      .sort({ date: -1, createdAt: -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
      .populate('recordedBy', 'name')
      .lean(),
    AttendanceRecord.countDocuments(safeFilter(filter)),
  ]);

  const mapped = (data as unknown[]).map((doc) => mapRecord(doc as Record<string, unknown>));

  return c.json({
    success: true,
    data: mapped,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /attendance/today — today's summary ─────────────
attendance.get('/today', authGuard, adminOnly, async (c) => {
  const date = today();

  const records = await AttendanceRecord.find(safeFilter({ date }))
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .populate('recordedBy', 'name')
    .lean();

  const allActiveTenants = await Tenant.countDocuments({ isActive: true });
  const present = records.filter(
    (r) => (r as unknown as Record<string, unknown>).status === 'present',
  ).length;
  const absent = records.filter(
    (r) => (r as unknown as Record<string, unknown>).status === 'absent',
  ).length;
  const onLeave = records.filter(
    (r) => (r as unknown as Record<string, unknown>).status === 'on_leave',
  ).length;
  const notReturned = allActiveTenants - records.length;

  const mapped = (records as unknown[]).map((doc) => mapRecord(doc as Record<string, unknown>));

  return c.json({
    success: true,
    data: {
      date,
      summary: { total: allActiveTenants, present, absent, onLeave, notReturned },
      records: mapped,
    },
  });
});

// ── GET /attendance/my — tenant's own attendance history ─
attendance.get('/my', authGuard, async (c) => {
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
    AttendanceRecord.find(filter)
      .sort({ date: -1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .lean(),
    AttendanceRecord.countDocuments(filter),
  ]);

  const mapped = (data as unknown[]).map((doc) => {
    const d = doc as Record<string, unknown>;
    return { ...d, checkInTime: d.checkIn, checkOutTime: d.checkOut };
  });

  return c.json({
    success: true,
    data: mapped,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /attendance/:id — single record ─────────────────
attendance.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid attendance ID');

  const record = await AttendanceRecord.findById(id)
    .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
    .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
    .populate('recordedBy', 'name')
    .lean();

  if (!record) return notFound(c, 'Attendance record');

  return c.json({ success: true, data: mapRecord(record as unknown as Record<string, unknown>) });
});

const updateAttendanceSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['present', 'absent', 'on_leave', 'not_returned']).optional(),
  // FE sends HH:mm; also accept ISO
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().max(500).optional(),
});

function parseTimeOnDate(dateStr: string, timeStr: string): Date | null {
  if (!timeStr) return null;
  // ISO datetime
  if (timeStr.includes('T') || timeStr.length > 8) {
    const d = new Date(timeStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // HH:mm or HH:mm:ss
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

// ── PUT /attendance/:id — admin correction ──────────────
attendance.put(
  '/:id',
  authGuard,
  adminOnly,
  zValidator('json', updateAttendanceSchema),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid attendance ID');

    const body = c.req.valid('json');
    const existing = await AttendanceRecord.findById(id);
    if (!existing) return notFound(c, 'Attendance record');

    const dateStr = body.date ?? existing.date;
    if (body.date !== undefined) existing.date = body.date;
    if (body.status !== undefined) existing.status = body.status;
    if (body.notes !== undefined) existing.notes = body.notes;

    const checkInRaw = body.checkInTime ?? body.checkIn;
    const checkOutRaw = body.checkOutTime ?? body.checkOut;
    if (checkInRaw !== undefined) {
      existing.checkIn = checkInRaw === '' || checkInRaw === null
        ? null
        : parseTimeOnDate(dateStr, checkInRaw);
    }
    if (checkOutRaw !== undefined) {
      existing.checkOut = checkOutRaw === '' || checkOutRaw === null
        ? null
        : parseTimeOnDate(dateStr, checkOutRaw);
    }

    await existing.save();

    const populated = await AttendanceRecord.findById(id)
      .populate({ path: 'tenantId', populate: { path: 'userId', select: 'name email phone' } })
      .populate({ path: 'tenantId', populate: { path: 'roomId', select: 'roomNumber' } })
      .populate('recordedBy', 'name')
      .lean();

    return c.json({
      success: true,
      data: mapRecord(populated as unknown as Record<string, unknown>),
    });
  },
);

// ── DELETE /attendance/:id — admin deletes a record ─────
attendance.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid attendance ID');

  const record = await AttendanceRecord.findById(id);
  if (!record) return notFound(c, 'Attendance record');

  await AttendanceRecord.findByIdAndDelete(id);

  return c.json({ success: true, data: { message: 'Attendance record deleted' } });
});

export default attendance;
