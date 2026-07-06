import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose, { Schema } from 'mongoose';
import crypto from 'node:crypto';
import { Tenant } from '../models/tenant.js';
import { Room } from '../models/room.js';
import { User } from '../models/user.js';
import { Payment } from '../models/payment.js';
import { Complaint } from '../models/complaint.js';
import { Invoice } from '../models/invoice.js';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import {
  parsePagination,
  parseId,
  notFound,
  badRequest,
  AppError,
  safeFilter,
} from '../lib/routeUtils.js';

// ── Cast helpers for Mongoose 9 ─────────────────────────
type CreateOneFn = (doc: Record<string, unknown>) => Promise<unknown>;
type CreateArrFn = (
  docs: Record<string, unknown>[],
  opts?: Record<string, unknown>,
) => Promise<unknown[]>;

const userCreate = User.create as unknown as CreateArrFn;
const tenantCreate = Tenant.create as unknown as CreateArrFn;

// ── Zod Schemas ──────────────────────────────────────────

const emergencyContactSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+91[6-9]\d{9}$/, 'Must be +91 format Indian mobile number'),
  relation: z.string().trim().min(1).max(50),
});

const createTenantSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(255).toLowerCase().trim(),
  phone: z
    .string()
    .trim()
    .regex(/^\+91[6-9]\d{9}$/, 'Must be +91XXXXXXXXXX format'),
  roomId: z.string().min(1, 'Room ID is required'),
  bedId: z.string().min(1, 'Bed ID is required'),
  moveInDate: z.string().datetime('Must be ISO 8601 date string'),
  monthlyRent: z.number().min(1000).max(50000),
  depositPaid: z.number().min(0).optional(),
  emergencyContact: emergencyContactSchema.optional(),
  aadhaarUrl: z.string().url().optional(),
  photoUrl: z.string().url().optional(),
});

const updateTenantSchema = z.strictObject({
  monthlyRent: z.number().min(1000).max(50000).optional(),
  depositPaid: z.number().min(0).optional(),
  emergencyContact: emergencyContactSchema.optional(),
});

// ── Router ───────────────────────────────────────────────

const router = new Hono();

// ── POST / — create tenant with full transaction (admin only)
router.post('/', authGuard, adminOnly, zValidator('json', createTenantSchema), async (c) => {
  const body = c.req.valid('json');
  const passwordHash = crypto.randomBytes(8).toString('hex');
  const session = await mongoose.startSession();

  try {
    let result: unknown;

    await session.withTransaction(async () => {
      const room = await Room.findById(body.roomId).session(session);
      if (!room) throw new AppError('Room not found', 400, 'ROOM_NOT_FOUND');
      if (!room.isActive) throw new AppError('Room is not active', 400, 'ROOM_INACTIVE');

      const bed = room.beds.find((b) => b.bedId === body.bedId);
      if (!bed) throw new AppError('Bed not found in this room', 400, 'BED_NOT_FOUND');
      if (bed.isOccupied) throw new AppError('Bed is already occupied', 400, 'BED_OCCUPIED');

      const [createdUser] = await userCreate(
        [
          {
            name: body.name,
            email: body.email,
            phone: body.phone,
            passwordHash,
            role: 'tenant',
            isActive: true,
            profilePhoto: body.photoUrl,
          },
        ],
        { session },
      );

      if (!createdUser) throw new AppError('Failed to create user', 500, 'USER_CREATE_FAILED');
      const u = createdUser as { _id: mongoose.Types.ObjectId };

      const [createdTenant] = await tenantCreate(
        [
          {
            userId: u._id,
            roomId: body.roomId,
            bedId: body.bedId,
            moveInDate: body.moveInDate,
            monthlyRent: body.monthlyRent,
            depositPaid: body.depositPaid ?? 0,
            emergencyContact: body.emergencyContact,
            aadhaarUrl: body.aadhaarUrl,
            isActive: true,
          },
        ],
        { session },
      );

      if (!createdTenant)
        throw new AppError('Failed to create tenant', 500, 'TENANT_CREATE_FAILED');
      const t = createdTenant as { _id: mongoose.Types.ObjectId; bedId: string };

      // Update bed
      const targetBed = room.beds.find((b) => b.bedId === body.bedId);
      if (targetBed) {
        targetBed.isOccupied = true;
        targetBed.tenantId = t._id as unknown as Schema.Types.ObjectId;
      }
      room.occupancyCount = room.beds.filter((b) => b.isOccupied).length;
      await room.save({ session });

      await User.findByIdAndUpdate(u._id, { tenantId: t._id }, { session });

      result = createdTenant;
    });

    return c.json({ success: true, data: result }, 201);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 404,
      );
    }
    throw err;
  } finally {
    session.endSession();
  }
});

// ── GET / — paginated list with filters (admin only)
router.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit } = parsePagination(c);
  const isActive = c.req.query('isActive');
  const roomId = c.req.query('roomId');
  const floorId = c.req.query('floorId');
  const search = c.req.query('search');

  const sortParam = c.req.query('sort') ?? '-createdAt';
  const order = sortParam.startsWith('-') ? -1 : 1;
  const sortField = sortParam.startsWith('-') ? sortParam.slice(1) : sortParam;
  const sortObj: Record<string, 1 | -1> = { [sortField]: order };

  const skip = (page - 1) * limit;

  let data: unknown[];
  let total: number;

  if (floorId) {
    const floorRooms = await Room.find(safeFilter({ floorId, isActive: true }))
      .select('_id')
      .lean();
    const roomIds = floorRooms.map((r) => r._id.toString());

    if (roomIds.length === 0) {
      return c.json({ success: true, data: [], meta: { total: 0, page, limit, totalPages: 0 } });
    }

    const f: Record<string, unknown> = { roomId: { $in: roomIds } };
    if (isActive !== undefined) f.isActive = isActive === 'true';
    if (search) {
      const users = await User.find({ name: { $regex: search, $options: 'i' } })
        .select('_id')
        .lean();
      f.userId = { $in: users.map((u) => u._id) };
    }

    [data, total] = await Promise.all([
      Tenant.find(safeFilter(f))
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('user')
        .populate('room')
        .lean(),
      Tenant.countDocuments(safeFilter(f)),
    ]);
  } else if (search) {
    const users = await User.find({ name: { $regex: search, $options: 'i' } })
      .select('_id')
      .lean();
    const userIds = users.map((u) => u._id);

    if (userIds.length === 0) {
      return c.json({ success: true, data: [], meta: { total: 0, page, limit, totalPages: 0 } });
    }

    const f: Record<string, unknown> = { userId: { $in: userIds } };
    if (isActive !== undefined) f.isActive = isActive === 'true';
    if (roomId) f.roomId = roomId;

    [data, total] = await Promise.all([
      Tenant.find(safeFilter(f))
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('user')
        .populate('room')
        .lean(),
      Tenant.countDocuments(safeFilter(f)),
    ]);
  } else {
    const f: Record<string, unknown> = {};
    if (isActive !== undefined) f.isActive = isActive === 'true';
    if (roomId) f.roomId = roomId;

    [data, total] = await Promise.all([
      Tenant.find(safeFilter(f))
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('user')
        .populate('room')
        .lean(),
      Tenant.countDocuments(safeFilter(f)),
    ]);
  }

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /:id — single tenant (admin or self)
router.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  const tenant = await Tenant.findById(id).populate('user').populate('room').lean();
  if (!tenant) return notFound(c, 'Tenant');

  const user = c.get('user');
  if (user?.role === 'tenant') {
    const doc = tenant as unknown as { userId?: { _id?: string } | string | null };
    const tenantUserId =
      doc.userId && typeof doc.userId === 'object' && doc.userId !== null
        ? (doc.userId as { _id: string })._id.toString()
        : String(doc.userId ?? '');

    if (tenantUserId !== user.sub) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } },
        403,
      );
    }
  }

  return c.json({ success: true, data: tenant });
});

// ── PUT /:id — update (admin only)
router.put('/:id', authGuard, adminOnly, zValidator('json', updateTenantSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  const body = c.req.valid('json');
  const tenant = await Tenant.findByIdAndUpdate(id, body, { new: true, runValidators: true })
    .populate('user')
    .populate('room')
    .lean();

  if (!tenant) return notFound(c, 'Tenant');
  return c.json({ success: true, data: tenant });
});

// ── POST /:id/checkout — checkout tenant (admin only)
router.post('/:id/checkout', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const tenant = await Tenant.findById(id).session(session);
      if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      if (!tenant.isActive) throw new AppError('Already checked out', 400, 'ALREADY_CHECKED_OUT');

      tenant.moveOutDate = new Date();
      tenant.isActive = false;
      await tenant.save({ session });

      const room = await Room.findById(tenant.roomId).session(session);
      if (room) {
        const bed = room.beds.find((b) => b.bedId === tenant.bedId);
        if (bed) {
          bed.isOccupied = false;
          bed.tenantId = null;
        }
        room.occupancyCount = room.beds.filter((b) => b.isOccupied).length;
        await room.save({ session });
      }

      await User.findByIdAndUpdate(tenant.userId, { isActive: false }, { session });
    });

    const updatedTenant = await Tenant.findById(id).populate('user').populate('room').lean();
    return c.json({ success: true, data: updatedTenant });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 404,
      );
    }
    throw err;
  } finally {
    session.endSession();
  }
});

// ── POST /:id/documents — placeholder
router.post('/:id/documents', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');
  return c.json(
    {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Document upload coming via Cloudinary.' },
    },
    501,
  );
});

// ── GET /:id/payments
router.get('/:id/payments', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');
  const payments = await Payment.find(safeFilter({ tenantId: id })).lean();
  return c.json({ success: true, data: payments });
});

// ── GET /:id/complaints
router.get('/:id/complaints', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');
  const complaints = await Complaint.find(safeFilter({ tenantId: id })).lean();
  return c.json({ success: true, data: complaints });
});

// ── GET /:id/invoices
router.get('/:id/invoices', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');
  const invoices = await Invoice.find(safeFilter({ tenantId: id })).lean();
  return c.json({ success: true, data: invoices });
});

export default router;
