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
import { Notification } from '../models/notification.js';
import { LeaveApplication } from '../models/leaveApplication.js';
import { Visitor } from '../models/visitor.js';
import { Guardian } from '../models/guardian.js';
import { LaundrySlot } from '../models/laundrySlot.js';
import { MealFeedback } from '../models/mealFeedback.js';
import { AttendanceRecord } from '../models/attendanceRecord.js';
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
import { isServiceAvailable } from '../lib/serviceAvailability.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { ServiceUnavailableError, ValidationError } from '../lib/errors.js';

// ── Cast helpers for Mongoose 9 ─────────────────────────
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
  isActive: z.boolean().optional(),
  bedId: z.enum(['A', 'B', 'C', 'D']).optional(),
  roomId: z.string().min(1).optional(),
  moveInDate: z.string().optional(),
  emergencyContact: emergencyContactSchema.optional(),
  user: z
    .strictObject({
      name: z.string().trim().min(2).max(100).optional(),
      email: z.string().email().max(255).toLowerCase().trim().optional(),
      phone: z
        .string()
        .trim()
        .regex(/^\+91[6-9]\d{9}$/, 'Must be +91XXXXXXXXXX format')
        .optional(),
    })
    .optional(),
});

// ── Router ───────────────────────────────────────────────

const router = new Hono();

// ── POST / — create tenant with full transaction (admin only)
router.post('/', authGuard, adminOnly, zValidator('json', createTenantSchema), async (c) => {
  const body = c.req.valid('json');

  // Pre-check duplicate email/phone for friendly errors
  const [emailExists, phoneExists] = await Promise.all([
    User.exists({ email: body.email }),
    User.exists({ phone: body.phone }),
  ]);
  if (emailExists) {
    return c.json(
      {
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'A user with this email already exists.' },
      },
      409,
    );
  }
  if (phoneExists) {
    return c.json(
      {
        success: false,
        error: {
          code: 'DUPLICATE_PHONE',
          message: 'A user with this phone number already exists.',
        },
      },
      409,
    );
  }

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
  const adminId = c.get('user').sub;

  const tenant = await Tenant.findById(id);
  if (!tenant) return notFound(c, 'Tenant');

  // Track room/bed changes for audit
  const oldRoomId = String(tenant.roomId);
  const oldBedId = tenant.bedId;

  // Update direct tenant fields
  const typedTenant = tenant as unknown as Record<string, unknown>;
  const directFields = ['monthlyRent', 'depositPaid', 'isActive', 'bedId'] as const;
  for (const field of directFields) {
    if (body[field] !== undefined) {
      typedTenant[field] = body[field];
    }
  }

  if (body.moveInDate !== undefined) {
    tenant.moveInDate = new Date(body.moveInDate);
  }

  if (body.emergencyContact !== undefined) {
    tenant.emergencyContact = {
      ...tenant.emergencyContact,
      ...body.emergencyContact,
    };
  }

  const tenantIdStr = String(tenant._id);

  // Handle room transfer
  if (body.roomId && body.roomId !== String(tenant.roomId)) {
    const newRoom = await Room.findById(body.roomId);
    if (!newRoom) return badRequest(c, 'New room not found', 'ROOM_NOT_FOUND');
    if (!newRoom.isActive) return badRequest(c, 'New room is not active', 'ROOM_INACTIVE');

    // Free old bed
    const oldRoom = await Room.findById(tenant.roomId);
    if (oldRoom) {
      const oldBed = oldRoom.beds.find((b) => b.bedId === tenant.bedId);
      if (oldBed) {
        oldBed.isOccupied = false;
        oldBed.tenantId = null;
      }
      oldRoom.occupancyCount = oldRoom.beds.filter((b) => b.isOccupied).length;
      await oldRoom.save();
    }

    // Reserve new bed
    const newBedId = body.bedId ?? tenant.bedId;
    const newBed = newRoom.beds.find((b) => b.bedId === newBedId);
    if (!newBed) return badRequest(c, 'Bed not found in new room', 'BED_NOT_FOUND');
    if (newBed.isOccupied && String(newBed.tenantId ?? '') !== tenantIdStr) {
      return badRequest(c, 'Bed is already occupied', 'BED_OCCUPIED');
    }

    newBed.isOccupied = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newBed.tenantId = tenant._id as any;
    newRoom.markModified('beds');
    newRoom.occupancyCount = newRoom.beds.filter((b) => b.isOccupied).length;

    await newRoom.save();

    tenant.roomId = body.roomId as unknown as mongoose.Schema.Types.ObjectId;
    tenant.bedId = newBedId;
  } else if (body.bedId && body.bedId !== tenant.bedId) {
    // Same room, different bed
    const currentRoom = await Room.findById(tenant.roomId);
    if (currentRoom) {
      const oldBed = currentRoom.beds.find((b) => b.bedId === tenant.bedId);
      if (oldBed) {
        oldBed.isOccupied = false;
        oldBed.tenantId = null;
      }
      const newBed = currentRoom.beds.find((b) => b.bedId === body.bedId);
      if (newBed) {
        if (newBed.isOccupied && String(newBed.tenantId ?? '') !== tenantIdStr) {
          return badRequest(c, 'Target bed is already occupied', 'BED_OCCUPIED');
        }
        newBed.isOccupied = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newBed.tenantId = tenant._id as any;
      }
      currentRoom.occupancyCount = currentRoom.beds.filter((b) => b.isOccupied).length;
      await currentRoom.save();
    }
    tenant.bedId = body.bedId;
  }

  // Update user details if provided
  if (body.user) {
    const userFields: Record<string, string | undefined> = {};
    if (body.user.name) userFields.name = body.user.name;
    if (body.user.email) userFields.email = body.user.email;
    if (body.user.phone) userFields.phone = body.user.phone;
    if (Object.keys(userFields).length > 0) {
      await User.findByIdAndUpdate(tenant.userId, userFields);
    }
  }

  await tenant.save();

  // Write audit log for room/bed transfers
  const newRoomId = body.roomId ?? oldRoomId;
  const newBedId = body.bedId ?? oldBedId;
  if (oldRoomId !== String(newRoomId) || oldBedId !== newBedId) {
    try {
      const { writeAuditLog } = await import('../lib/write-audit-log.js');
      await writeAuditLog({
        userId: adminId,
        action: 'update',
        resource: 'tenant',
        resourceId: id,
        details: {
          roomTransfer: oldRoomId !== String(newRoomId),
          bedSwap: oldBedId !== newBedId,
          fromRoomId: oldRoomId,
          toRoomId: String(body.roomId ?? tenant.roomId),
          fromBedId: oldBedId,
          toBedId: newBedId,
        },
      });
    } catch {
      // Audit log failure should not block the tenant update
    }
  }

  const populatedTenant = await Tenant.findById(id).populate('user').populate('room').lean();

  return c.json({ success: true, data: populatedTenant });
});

// ── POST /:id/checkout — checkout tenant (admin only)
router.post('/:id/checkout', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  // Check for unpaid invoices before allowing checkout
  const unpaidCount = await Invoice.countDocuments(
    safeFilter({
      tenantId: id,
      status: { $in: ['sent', 'partial', 'overdue'] },
    }),
  );
  if (unpaidCount > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNPAID_INVOICES',
          message: `Tenant has ${unpaidCount} unpaid invoice(s). Please clear all dues before checkout.`,
        },
      },
      409,
    );
  }

  // Check for unverified/overdue payments that would block checkout
  const unresolvedPayments = await Payment.countDocuments(
    safeFilter({
      tenantId: id,
      status: { $in: ['pending_verification', 'overdue'] },
    }),
  );
  if (unresolvedPayments > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNRESOLVED_PAYMENTS',
          message: `Tenant has ${unresolvedPayments} unresolved payment(s). Please verify or cancel them before checkout.`,
        },
      },
      409,
    );
  }

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

// ── POST /:id/reinstate — reinstate a checked-out tenant (admin only)
router.post('/:id/reinstate', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const tenant = await Tenant.findById(id).session(session);
      if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      if (tenant.isActive) throw new AppError('Tenant is already active', 400, 'ALREADY_ACTIVE');

      const room = await Room.findById(tenant.roomId).session(session);
      if (!room) throw new AppError('Original room not found', 404, 'ROOM_NOT_FOUND');
      if (!room.isActive)
        throw new AppError('Original room is no longer active', 400, 'ROOM_INACTIVE');

      const bed = room.beds.find((b) => b.bedId === tenant.bedId);
      if (!bed) throw new AppError('Original bed not found in room', 404, 'BED_NOT_FOUND');
      if (bed.isOccupied) {
        throw new AppError(
          `Bed ${tenant.bedId} is now occupied by another tenant. Change bed assignment first.`,
          409,
          'BED_OCCUPIED',
        );
      }

      bed.isOccupied = true;
      bed.tenantId = tenant._id as unknown as Schema.Types.ObjectId;
      room.occupancyCount = room.beds.filter((b) => b.isOccupied).length;
      await room.save({ session });

      tenant.isActive = true;
      tenant.moveOutDate = null;
      await tenant.save({ session });

      await User.findByIdAndUpdate(tenant.userId, { isActive: true }, { session });
    });

    const updatedTenant = await Tenant.findById(id).populate('user').populate('room').lean();
    return c.json({ success: true, data: updatedTenant });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 404 | 409,
      );
    }
    throw err;
  } finally {
    session.endSession();
  }
});

// ── POST /:id/documents — upload KYC documents (Aadhaar, photo)
router.post('/:id/documents', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) throw new ValidationError('Invalid tenant ID');

  // Check Cloudinary availability with graceful degradation
  if (!isServiceAvailable('cloudinary')) {
    throw new ServiceUnavailableError(
      'Cloudinary',
      'Document uploads are not available because Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment variables.',
    );
  }

  const tenant = await Tenant.findById(id);
  if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

  try {
    const body = await c.req.parseBody();
    const docType = (body?.docType as string) || 'aadhaar';

    if (!['aadhaar', 'photo'].includes(docType)) {
      throw new ValidationError('docType must be "aadhaar" or "photo"');
    }

    const file = body?.file as File | undefined;
    if (!file || !(file instanceof File)) {
      throw new ValidationError(
        'A file is required. Use multipart/form-data with field name "file".',
      );
    }

    // Validate file type and size
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError('Invalid file type. Allowed: JPEG, PNG, WebP, PDF.');
    }

    if (file.size > MAX_SIZE) {
      throw new ValidationError('File size must be under 5MB.');
    }

    // Build Cloudinary upload form
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('public_id', `tenants/${id}/${docType}_${Date.now()}`);
    uploadForm.append('folder', `tenet_pg/tenants/${id}`);
    uploadForm.append('upload_preset', ''); // Use unsigned upload or API key

    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: uploadForm,
      headers: {
        Authorization: `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}`,
      },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg =
        (errData as { error?: { message?: string } })?.error?.message ?? 'Upload failed';
      logger.error({ tenantId: id, docType, cloudinaryError: errMsg }, 'Cloudinary upload failed');
      throw new AppError(
        `Document upload failed: ${errMsg}`,
        502,
        'UPLOAD_FAILED',
        undefined,
        'The document upload could not be completed. Please try again.',
      );
    }

    const result = (await response.json()) as {
      secure_url: string;
      public_id: string;
      format: string;
      width?: number;
      height?: number;
    };

    // Update tenant with document URL (nested under documents field)
    if (!tenant.documents) {
      (tenant as unknown as Record<string, unknown>).documents = {};
    }
    if (docType === 'aadhaar') {
      tenant.documents.aadhaarUrl = result.secure_url;
    } else {
      tenant.documents.photoUrl = result.secure_url;
    }
    await tenant.save();

    logger.info({ tenantId: id, docType, url: result.secure_url }, 'Tenant document uploaded');

    return c.json({
      success: true,
      data: {
        docType,
        url: result.secure_url,
        message: `${docType === 'aadhaar' ? 'Aadhaar' : 'Photo'} uploaded successfully.`,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.publicMessage } },
        err.status as 200,
      );
    }
    throw err;
  }
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

// ── DELETE /:id — delete tenant with full cascade (admin only)
router.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  const session = await mongoose.startSession();
  try {
    const deletedCounts: Record<string, number> = {};

    await session.withTransaction(async () => {
      const tenant = await Tenant.findById(id).session(session);
      if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

      const tenantIdStr = String(tenant._id);

      // Cascade-delete all child entities
      const paymentResult = await Payment.deleteMany(safeFilter({ tenantId: tenantIdStr })).session(
        session,
      );
      deletedCounts.payments = paymentResult.deletedCount;

      const complaintResult = await Complaint.deleteMany(
        safeFilter({ tenantId: tenantIdStr }),
      ).session(session);
      deletedCounts.complaints = complaintResult.deletedCount;

      const invoiceResult = await Invoice.deleteMany(safeFilter({ tenantId: tenantIdStr })).session(
        session,
      );
      deletedCounts.invoices = invoiceResult.deletedCount;

      const visitorResult = await Visitor.deleteMany(safeFilter({ tenantId: tenantIdStr })).session(
        session,
      );
      deletedCounts.visitors = visitorResult.deletedCount;

      const guardianResult = await Guardian.deleteMany(
        safeFilter({ tenantId: tenantIdStr }),
      ).session(session);
      deletedCounts.guardians = guardianResult.deletedCount;

      const laundryResult = await LaundrySlot.deleteMany(
        safeFilter({ tenantId: tenantIdStr }),
      ).session(session);
      deletedCounts.laundrySlots = laundryResult.deletedCount;

      const mealFeedbackResult = await MealFeedback.deleteMany(
        safeFilter({ tenantId: tenantIdStr }),
      ).session(session);
      deletedCounts.mealFeedbacks = mealFeedbackResult.deletedCount;

      const attendanceResult = await AttendanceRecord.deleteMany(
        safeFilter({ tenantId: tenantIdStr }),
      ).session(session);
      deletedCounts.attendanceRecords = attendanceResult.deletedCount;

      const leaveResult = await LeaveApplication.deleteMany(
        safeFilter({ tenantId: tenantIdStr }),
      ).session(session);
      deletedCounts.leaveApplications = leaveResult.deletedCount;

      // Free the bed
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

      // Clear user's uniqueness fields so they can be re-added later
      const userResult = await User.findByIdAndUpdate(
        tenant.userId,
        {
          isActive: false,
          email: `deleted:${Date.now()}:${Date.now()}`,
          phone: `deleted:${Date.now()}:${Date.now()}`,
        },
        { session },
      );
      if (userResult) deletedCounts.user = 1;

      // Remove tenant record
      await Tenant.findByIdAndDelete(id, { session });
      deletedCounts.tenant = 1;

      logger.info({ tenantId: id, deletedCounts }, 'Tenant and children cascade-deleted');
    });

    return c.json({
      success: true,
      data: { message: 'Tenant and associated records deleted', deletedCounts },
    });
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

// ── GET /:id/invoices
router.get('/:id/invoices', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');
  const invoices = await Invoice.find(safeFilter({ tenantId: id })).lean();
  return c.json({ success: true, data: invoices });
});

// ── GET /:id/dues — checkout dues summary (admin only)
router.get('/:id/dues', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  const tenant = await Tenant.findById(id).lean();
  if (!tenant) return notFound(c, 'Tenant');
  if (!tenant.isActive) {
    return c.json({
      success: true,
      data: {
        totalDue: 0,
        unpaidInvoices: [],
        electricityDues: 0,
        depositHeld: tenant.depositPaid,
        checkedOut: true,
      },
    });
  }

  // Find unpaid/partial/overdue invoices
  const unpaidInvoices = await Invoice.find(
    safeFilter({ tenantId: id, status: { $in: ['sent', 'partial', 'overdue'] } }),
  )
    .select('invoiceNumber month totalAmount status')
    .lean();

  const invoiceTotal = unpaidInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  // Find pending/overdue payments
  const pendingPayments = await Payment.find(
    safeFilter({ tenantId: id, status: { $in: ['pending', 'pending_verification', 'overdue'] } }),
  )
    .select('amount type status month')
    .lean();

  const paymentDue = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Electricity dues from invoices that have electricity charges
  const electricityInvoices = unpaidInvoices.filter((inv) => inv.status !== 'paid');
  const electricityDues = electricityInvoices.reduce((sum, inv) => {
    // Check line items for electricity charges
    const invDoc = inv as unknown as { lineItems?: Array<{ description: string; amount: number }> };
    const lines = invDoc.lineItems || [];
    return (
      sum +
      lines.filter((li) => /electricity/i.test(li.description)).reduce((s, li) => s + li.amount, 0)
    );
  }, 0);

  const totalDue = Math.max(invoiceTotal, paymentDue);

  return c.json({
    success: true,
    data: {
      totalDue,
      unpaidInvoices: unpaidInvoices.map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        month: inv.month,
        totalAmount: inv.totalAmount,
        status: inv.status,
      })),
      electricityDues,
      depositHeld: tenant.depositPaid || 0,
      pendingPayments: pendingPayments.length,
      checkedOut: false,
    },
  });
});

// ── GET /:id/activity — aggregated tenant activity timeline
router.get('/:id/activity', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid tenant ID');

  const events: Array<Record<string, unknown>> = [];

  // 1. Tenant move-in event
  const tenant = await Tenant.findById(id)
    .select('moveInDate createdAt isActive moveOutDate')
    .lean();
  if (tenant) {
    events.push({
      id: `movein-${String(tenant._id)}`,
      type: 'move_in',
      title: 'Moved in',
      date: tenant.moveInDate || tenant.createdAt,
    });

    if (tenant.moveOutDate) {
      events.push({
        id: `checkout-${String(tenant._id)}`,
        type: 'checkout',
        title: 'Checked out',
        date: tenant.moveOutDate,
      });
    }
  }

  // 2. Payments made
  const payments = await Payment.find(safeFilter({ tenantId: id }))
    .select('amount type status paidAt createdAt method')
    .sort({ createdAt: -1 })
    .lean();

  for (const p of payments) {
    events.push({
      id: `payment-${String(p._id)}`,
      type: p.status === 'paid' ? 'payment_verified' : 'payment',
      title: `Payment ${p.status === 'paid' ? 'verified' : 'received'}`,
      subtitle: `Via ${p.method}`,
      amount: p.amount,
      date: p.paidAt || p.createdAt,
      status: p.status,
    });
  }

  // 3. Complaints filed
  const complaints = await Complaint.find(safeFilter({ tenantId: id }))
    .select('title status createdAt')
    .sort({ createdAt: -1 })
    .lean();

  for (const c of complaints) {
    events.push({
      id: `complaint-${String(c._id)}`,
      type: c.status === 'resolved' ? 'complaint_resolved' : 'complaint_filed',
      title: c.title || 'Complaint',
      subtitle: c.status === 'resolved' ? 'Resolved' : c.status,
      date: c.createdAt,
      status: c.status,
    });
  }

  // 4. Leaves taken (if attendance feature enabled)
  const leaves = await LeaveApplication.find(safeFilter({ tenantId: id }))
    .select('fromDate toDate status createdAt')
    .sort({ createdAt: -1 })
    .lean();

  for (const l of leaves) {
    events.push({
      id: `leave-${String(l._id)}`,
      type: 'leave',
      title: `Leave: ${l.fromDate} → ${l.toDate}`,
      subtitle: l.status,
      date: l.createdAt,
      status: l.status,
    });
  }

  // 5. Notifications received (notices/announcements targeted)
  const notifications = await Notification.find({
    $or: [{ targetType: 'all' }, { targetIds: id }],
    type: { $in: ['announcement', 'welcome'] },
  })
    .select('title body sentAt type')
    .sort({ sentAt: -1 })
    .limit(20)
    .lean();

  for (const n of notifications) {
    events.push({
      id: `notice-${String(n._id)}`,
      type: 'notice',
      title: n.title || 'Notice',
      subtitle: n.body?.slice(0, 80),
      date: n.sentAt,
    });
  }

  // Sort all events by date descending
  events.sort((a, b) => {
    const da = new Date(a.date as string).getTime();
    const db = new Date(b.date as string).getTime();
    return db - da;
  });

  return c.json({ success: true, data: events });
});

export default router;
