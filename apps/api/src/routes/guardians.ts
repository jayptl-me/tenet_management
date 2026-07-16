import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Guardian } from '../models/guardian.js';
import { User } from '../models/user.js';
import { Tenant } from '../models/tenant.js';
import { AttendanceRecord } from '../models/attendanceRecord.js';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import {
  parsePagination,
  parseId,
  notFound,
  badRequest,
  safeFilter,
  AppError,
} from '../lib/routeUtils.js';
import { requireFeature } from '../middleware/featureFlags.js';

// ── Cast helpers for Mongoose 9 ─────────────────────────
type CreateArrFn = (
  docs: Record<string, unknown>[],
  opts?: Record<string, unknown>,
) => Promise<unknown[]>;

const userCreate = User.create.bind(User) as unknown as CreateArrFn;
const guardianCreate = Guardian.create.bind(Guardian) as unknown as CreateArrFn;

// ── Zod Schemas ──────────────────────────────────────────

const createGuardianSchema = z.strictObject({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  name: z.string().trim().min(1, 'Name is required').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+91[6-9]\d{9}$/, 'Must be +91 format Indian mobile number'),
  /** Required so the guardian User can log in and reset password. */
  email: z.string().email().max(255).toLowerCase().trim(),
  relation: z.enum(['father', 'mother', 'guardian', 'other']),
});

const updateGuardianSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+91[6-9]\d{9}$/, 'Must be +91 format Indian mobile number')
    .optional(),
  email: z.string().email().max(255).toLowerCase().trim().optional(),
  relation: z.enum(['father', 'mother', 'guardian', 'other']).optional(),
  isActive: z.boolean().optional(),
});

// ── Helper: map lean doc to frontend-friendly shape ─────
function mapGuardian(doc: Record<string, unknown>) {
  const tenantRaw = doc.tenantId;
  const tenant =
    tenantRaw && typeof tenantRaw === 'object'
      ? (tenantRaw as Record<string, unknown>)
      : undefined;
  const tenantUser = tenant?.userId as Record<string, unknown> | undefined;
  const room = tenant?.roomId as Record<string, unknown> | undefined;
  const tenantIdStr = tenant
    ? String(tenant._id ?? '')
    : tenantRaw
      ? String(tenantRaw)
      : '';

  return {
    ...doc,
    // Flat string for ResourceSelect / form reset
    tenantId: tenantIdStr,
    tenant: tenant
      ? {
          _id: tenantIdStr,
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
    isEmergencyContact: doc.relation === 'father' || doc.relation === 'mother',
  };
}

// ── Router ───────────────────────────────────────────────

const guardians = new Hono();
guardians.use('*', requireFeature('guardianPortalEnabled'));

// ── POST /guardians — create guardian (admin only) ──────
guardians.post('/', authGuard, adminOnly, zValidator('json', createGuardianSchema), async (c) => {
  const body = c.req.valid('json');
  // Plain temporary password — User pre-save hashes passwordHash field
  const temporaryPassword = crypto.randomBytes(4).toString('hex') + 'A1!';
  const session = await mongoose.startSession();

  try {
    let result: unknown;
    let userId: mongoose.Types.ObjectId | undefined;

    await session.withTransaction(async () => {
      // Validate tenant exists
      const tenant = await Tenant.findById(body.tenantId).session(session);
      if (!tenant) throw new AppError('Tenant not found', 400, 'TENANT_NOT_FOUND');

      // Create guardian user account
      const [createdUser] = await userCreate(
        [
          {
            name: body.name,
            phone: body.phone,
            email: body.email,
            passwordHash: temporaryPassword,
            role: 'guardian',
            isActive: true,
          },
        ],
        { session },
      );

      if (!createdUser)
        throw new AppError('Failed to create guardian user', 500, 'USER_CREATE_FAILED');
      const u = createdUser as { _id: mongoose.Types.ObjectId };
      userId = u._id;

      // Create guardian record
      const [createdGuardian] = await guardianCreate(
        [
          {
            userId: u._id,
            tenantId: body.tenantId,
            name: body.name,
            phone: body.phone,
            email: body.email,
            relation: body.relation,
            isActive: true,
          },
        ],
        { session },
      );

      if (!createdGuardian)
        throw new AppError('Failed to create guardian', 500, 'GUARDIAN_CREATE_FAILED');

      const g = createdGuardian as { _id: mongoose.Types.ObjectId };
      await User.findByIdAndUpdate(u._id, { guardianId: String(g._id) }, { session });

      result = createdGuardian;
    });

    // Re-fetch with populates outside transaction
    const guardian = result as { _id: mongoose.Types.ObjectId };
    const populated = await Guardian.findById(guardian._id)
      .populate({
        path: 'tenantId',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .populate({
        path: 'tenantId',
        populate: { path: 'roomId', select: 'roomNumber' },
      })
      .lean();

    return c.json(
      {
        success: true,
        data: {
          ...mapGuardian(populated as unknown as Record<string, unknown>),
          // One-time credential for admin to share — never stored as plain text after create
          temporaryPassword,
          userId: userId ? String(userId) : undefined,
        },
      },
      201,
    );
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 404,
      );
    }
    // Duplicate phone/email
    if ((err as { code?: number })?.code === 11000) {
      return c.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_USER',
            message: 'A user with this phone or email already exists.',
          },
        },
        409,
      );
    }
    throw err;
  } finally {
    session.endSession();
  }
});

// ── GET /guardians — admin paginated list ───────────────
guardians.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit } = parsePagination(c);
  const search = c.req.query('search');
  const tenantIdQ = c.req.query('tenantId');

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }
  if (tenantIdQ) {
    const tid = parseId(tenantIdQ);
    if (!tid) return badRequest(c, 'Invalid tenantId');
    filter.tenantId = tid;
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Guardian.find(safeFilter(filter))
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
      .lean(),
    Guardian.countDocuments(safeFilter(filter)),
  ]);

  const mapped = (data as unknown[]).map((doc) => mapGuardian(doc as Record<string, unknown>));

  return c.json({
    success: true,
    data: mapped,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /guardians/me/ward — guardian views linked tenant
// Static paths MUST be registered before /:id
guardians.get('/me/ward', authGuard, async (c) => {
  const authUser = c.get('user');

  if (authUser?.role !== 'guardian') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only guardians can access this endpoint.' },
      },
      403,
    );
  }

  const guardian = await Guardian.findOne(safeFilter({ userId: authUser.sub, isActive: true }))
    .populate({
      path: 'tenantId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate({
      path: 'tenantId',
      populate: { path: 'roomId', select: 'roomNumber' },
    })
    .lean();

  if (!guardian) return notFound(c, 'Guardian record');

  return c.json({
    success: true,
    data: mapGuardian(guardian as unknown as Record<string, unknown>),
  });
});

// ── GET /guardians/me/ward/attendance ───────────────────
guardians.get('/me/ward/attendance', authGuard, async (c) => {
  const authUser = c.get('user');
  const { page, limit } = parsePagination(c);

  if (authUser?.role !== 'guardian') {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only guardians can access this endpoint.' },
      },
      403,
    );
  }

  const guardian = await Guardian.findOne(
    safeFilter({ userId: authUser.sub, isActive: true }),
  ).lean();
  if (!guardian) return notFound(c, 'Guardian record');

  const tenantId = (guardian as unknown as Record<string, unknown>).tenantId?.toString();
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

// ── GET /guardians/:id — single guardian ────────────────
guardians.get('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid guardian ID');

  const guardian = await Guardian.findById(id)
    .populate({
      path: 'tenantId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate({
      path: 'tenantId',
      populate: { path: 'roomId', select: 'roomNumber' },
    })
    .lean();

  if (!guardian) return notFound(c, 'Guardian');

  return c.json({
    success: true,
    data: mapGuardian(guardian as unknown as Record<string, unknown>),
  });
});

// ── PUT /guardians/:id — update guardian ────────────────
guardians.put('/:id', authGuard, adminOnly, zValidator('json', updateGuardianSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid guardian ID');

  const body = c.req.valid('json');

  const guardian = await Guardian.findByIdAndUpdate(id, body, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate({
      path: 'tenantId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .populate({
      path: 'tenantId',
      populate: { path: 'roomId', select: 'roomNumber' },
    })
    .lean();

  if (!guardian) return notFound(c, 'Guardian');

  // Keep linked User identity + active flag in sync
  const g = guardian as unknown as { userId?: unknown };
  const userId = g.userId;
  if (userId && (body.name || body.phone || body.email !== undefined || body.isActive !== undefined)) {
    const userUpdate: Record<string, unknown> = {};
    if (body.name) userUpdate.name = body.name;
    if (body.phone) userUpdate.phone = body.phone;
    if (body.email !== undefined) userUpdate.email = body.email;
    if (body.isActive !== undefined) userUpdate.isActive = body.isActive;
    await User.findByIdAndUpdate(userId, userUpdate);
  }

  return c.json({
    success: true,
    data: mapGuardian(guardian as unknown as Record<string, unknown>),
  });
});

// ── DELETE /guardians/:id — deactivate guardian and User ─
guardians.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid guardian ID');

  const guardian = await Guardian.findById(id);
  if (!guardian) return notFound(c, 'Guardian');

  guardian.isActive = false;
  await guardian.save();

  const userResult = await User.findByIdAndUpdate(
    guardian.userId,
    { isActive: false },
    { returnDocument: 'after' },
  );

  return c.json({
    success: true,
    data: {
      message: 'Guardian deactivated',
      userDeactivated: !!userResult,
    },
  });
});

export default guardians;
