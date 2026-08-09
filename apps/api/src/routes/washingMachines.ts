import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import {
  notFound,
  badRequest,
  conflict,
  parseId,
  parsePagination,
  safeFilter,
} from '../lib/routeUtils.js';
import { WashingMachine } from '../models/washingMachine.js';
import { Floor } from '../models/floor.js';
import { Tenant } from '../models/tenant.js';
import { Room } from '../models/room.js';
import { writeAuditLog } from '../lib/write-audit-log.js';
import { requireFeature } from '../middleware/featureFlags.js';

const washingMachines = new Hono();
washingMachines.use('*', requireFeature('laundryEnabled'));

// ── Schemas ─────────────────────────────────────────────
// Create/update never allow 'in_use' — that's set by claim only.
const createSchema = z.strictObject({
  floorId: z.string().min(1, 'Floor is required'),
  machineNumber: z.number().int().min(1, 'Machine number must be at least 1'),
  label: z.string().max(80).optional(),
  status: z.enum(['available', 'under_maintenance', 'down']).default('available'),
  timerDuration: z.number().int().min(10).max(180).default(50),
  notes: z.string().max(500).optional(),
});

const updateSchema = z.strictObject({
  label: z.string().max(80).optional(),
  machineNumber: z.number().int().min(1).optional(),
  status: z.enum(['available', 'under_maintenance', 'down']).optional(),
  timerDuration: z.number().int().min(10).max(180).optional(),
  notes: z.string().max(500).optional(),
});

const claimSchema = z.strictObject({
  timerDuration: z.number().int().min(10).max(180).optional(),
});

/** Map a lean washing machine doc with floor + currentUser populated. */
function mapMachine(doc: Record<string, unknown>) {
  const floorRaw = doc.floor;
  const floor =
    floorRaw && typeof floorRaw === 'object' ? (floorRaw as Record<string, unknown>) : undefined;
  const currentUserRaw = doc.currentUser;
  const currentUser =
    currentUserRaw && typeof currentUserRaw === 'object'
      ? (currentUserRaw as Record<string, unknown>)
      : undefined;
  const userRaw = currentUser?.userId;
  const user =
    userRaw && typeof userRaw === 'object' ? (userRaw as Record<string, unknown>) : undefined;
  const roomRaw = currentUser?.roomId;
  const room =
    roomRaw && typeof roomRaw === 'object' ? (roomRaw as Record<string, unknown>) : undefined;

  return {
    ...doc,
    floorLabel: floor?.label as string | undefined,
    floorNumber: floor?.floorNumber as number | undefined,
    currentUser: currentUser
      ? {
          id: String(currentUser._id ?? ''),
          name: user?.name as string | undefined,
          room: room?.roomNumber as string | undefined,
        }
      : undefined,
  };
}

/** Resolve tenant's floorId from their user sub. Returns null if unresolvable. */
async function resolveTenantFloorId(userSub: string): Promise<string | null> {
  const tenant = await Tenant.findOne({ userId: userSub } as Record<string, unknown>)
    .select('roomId')
    .lean();
  if (!tenant) return null;
  const room = await Room.findById(tenant.roomId).select('floorId').lean();
  if (!room) return null;
  return String(room.floorId);
}

// ── GET /washing-machines ──────────────────────────────
washingMachines.get('/', authGuard, async (c) => {
  const filter: Record<string, unknown> = {};

  const floorIdQ = c.req.query('floorId');
  if (floorIdQ) {
    const parsed = parseId(floorIdQ);
    if (!parsed) return badRequest(c, 'Invalid floorId');
    filter.floorId = parsed;
  }

  const statusQ = c.req.query('status');
  if (statusQ) {
    if (!['available', 'in_use', 'under_maintenance', 'down'].includes(statusQ)) {
      return badRequest(c, 'Invalid status');
    }
    filter.status = statusQ;
  }

  const user = c.get('user');

  // Tenants see only machines on their own floor
  if (user.role === 'tenant') {
    const tenantFloorId = await resolveTenantFloorId(user.sub);
    if (!tenantFloorId) return c.json({ success: true, data: [] });
    filter.floorId = tenantFloorId;
  }

  const pagination = parsePagination(c);
  const { skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    (
      WashingMachine as unknown as {
        find: (filter: Record<string, unknown>) => ReturnType<typeof WashingMachine.find>;
      }
    )
      .find(filter)
      .sort({ machineNumber: 1 } as Record<string, 1>)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'floor', select: 'label floorNumber' })
      .populate({
        path: 'currentUser',
        populate: [
          { path: 'userId', select: 'name' },
          { path: 'roomId', select: 'roomNumber' },
        ],
      })
      .lean(),
    WashingMachine.countDocuments(safeFilter(filter)),
  ]);

  return c.json({
    success: true,
    data: (data as unknown as Record<string, unknown>[]).map(mapMachine),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /washing-machines/floor/:floorId ───────────────
// All machines on a floor with current-user info — used by Flutter and admin grid
washingMachines.get('/floor/:floorId', authGuard, async (c) => {
  const floorId = parseId(c.req.param('floorId'));
  if (!floorId) return badRequest(c, 'Invalid floor ID');

  const user = c.get('user');

  // WM-1: Tenant-floor ownership check — tenants may only view their own floor
  if (user.role === 'tenant') {
    const tenantFloorId = await resolveTenantFloorId(user.sub);
    if (!tenantFloorId || tenantFloorId !== floorId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only view washing machines on your floor.',
          },
        },
        403,
      );
    }
  }

  const floor = await Floor.findById(floorId).lean();
  if (!floor) return notFound(c, 'Floor');

  const data = await WashingMachine.find(safeFilter({ floorId }))
    .sort({ machineNumber: 1 })
    .populate({
      path: 'currentUser',
      populate: [
        { path: 'userId', select: 'name' },
        { path: 'roomId', select: 'roomNumber' },
      ],
    })
    .lean();

  return c.json({
    success: true,
    data: {
      floor: { _id: floor._id, label: floor.label, floorNumber: floor.floorNumber },
      machines: (data as unknown as Record<string, unknown>[]).map(mapMachine),
    },
  });
});

// ── GET /washing-machines/:id ──────────────────────────
washingMachines.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid machine ID');

  const machine = await WashingMachine.findById(id)
    .populate({ path: 'floor', select: 'label floorNumber' })
    .populate({
      path: 'currentUser',
      populate: [
        { path: 'userId', select: 'name' },
        { path: 'roomId', select: 'roomNumber' },
      ],
    })
    .lean();
  if (!machine) return notFound(c, 'Washing machine');

  return c.json({ success: true, data: mapMachine(machine as unknown as Record<string, unknown>) });
});

// ── POST /washing-machines ────────────────────────────
washingMachines.post('/', authGuard, adminOnly, zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  // Validate floor exists
  const floor = await Floor.findById(body.floorId).lean();
  if (!floor) return notFound(c, 'Floor');

  try {
    const doc = await WashingMachine.create({
      floorId: new mongoose.Types.ObjectId(body.floorId),
      machineNumber: body.machineNumber,
      label: body.label ?? `Machine ${body.machineNumber}`,
      status: body.status,
      timerDuration: body.timerDuration,
      notes: body.notes ?? '',
    });
    const created = await WashingMachine.findById(doc._id)
      .populate({ path: 'floor', select: 'label floorNumber' })
      .populate({
        path: 'currentUser',
        populate: [
          { path: 'userId', select: 'name' },
          { path: 'roomId', select: 'roomNumber' },
        ],
      })
      .lean();

    await writeAuditLog({
      userId: user.sub,
      action: 'create',
      resource: 'washing_machine',
      resourceId: String(doc._id),
      details: { floorId: body.floorId, machineNumber: body.machineNumber },
    });

    return c.json(
      { success: true, data: mapMachine(created as unknown as Record<string, unknown>) },
      201,
    );
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return conflict(
        c,
        'A machine with this number already exists on this floor',
        'DUPLICATE_MACHINE',
      );
    }
    throw err;
  }
});

// ── PUT /washing-machines/:id ──────────────────────────
washingMachines.put('/:id', authGuard, adminOnly, zValidator('json', updateSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid machine ID');

  const body = c.req.valid('json');
  const user = c.get('user');

  try {
    // When setting a non-in_use status, clear any existing claim
    const updateBody: Record<string, unknown> = { ...body };
    if (
      body.status === 'available' ||
      body.status === 'under_maintenance' ||
      body.status === 'down'
    ) {
      updateBody.currentUserId = null;
      updateBody.claimedAt = null;
      updateBody.timerEndsAt = null;
    }

    const machine = await WashingMachine.findByIdAndUpdate(id, updateBody, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate({ path: 'floor', select: 'label floorNumber' })
      .populate({
        path: 'currentUser',
        populate: [
          { path: 'userId', select: 'name' },
          { path: 'roomId', select: 'roomNumber' },
        ],
      })
      .lean();
    if (!machine) return notFound(c, 'Washing machine');

    await writeAuditLog({
      userId: user.sub,
      action: 'update',
      resource: 'washing_machine',
      resourceId: id,
      details: { ...body },
    });

    return c.json({
      success: true,
      data: mapMachine(machine as unknown as Record<string, unknown>),
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return conflict(c, 'Machine number already taken on this floor', 'DUPLICATE_MACHINE');
    }
    throw err;
  }
});

// ── POST /washing-machines/:id/claim — tenant claims a machine ──
washingMachines.post('/:id/claim', authGuard, zValidator('json', claimSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid machine ID');

  const body = c.req.valid('json');
  const user = c.get('user');

  // Only tenants can claim
  if (user.role !== 'tenant') {
    return badRequest(c, 'Only tenants can claim a washing machine', 'FORBIDDEN');
  }

  // Find the tenant profile
  const tenant = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();
  if (!tenant) {
    return badRequest(c, 'No active tenant profile found', 'TENANT_REQUIRED');
  }

  const tenantId = String((tenant as unknown as Record<string, unknown>)._id ?? '');

  // Verify the machine is on the tenant's floor (requires room lookup)
  const room = await Room.findById((tenant as unknown as Record<string, unknown>).roomId)
    .select('floorId')
    .lean();
  const targetMachine = await WashingMachine.findById(id).select('floorId timerDuration').lean();
  if (!targetMachine) return notFound(c, 'Washing machine');
  if (
    !room ||
    String(room.floorId) !== String((targetMachine as unknown as Record<string, unknown>).floorId)
  ) {
    return badRequest(c, 'This washing machine is not on your floor', 'WRONG_FLOOR');
  }

  // WM-2: Atomic claim — findOneAndUpdate with conditional to prevent double-booking
  const now = new Date();
  const duration =
    body.timerDuration ??
    ((targetMachine as unknown as Record<string, unknown>).timerDuration as number) ??
    50;
  const timerEnds = new Date(now.getTime() + duration * 60 * 1000);

  // First, check tenant doesn't already have an active claim (separate query for better error message)
  const existingClaim = await WashingMachine.findOne({
    currentUserId: tenantId,
    status: 'in_use',
    _id: { $ne: new mongoose.Types.ObjectId(id) },
  } as Record<string, unknown>).lean();
  if (existingClaim) {
    return conflict(
      c,
      'You already have an active washing machine claim. Release it first.',
      'ALREADY_CLAIMED',
    );
  }

  // Atomic: only update if status is still 'available'
  const machine = await WashingMachine.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(id),
      status: 'available',
    },
    {
      $set: {
        status: 'in_use',
        currentUserId: new mongoose.Types.ObjectId(tenantId),
        claimedAt: now,
        timerDuration: duration,
        timerEndsAt: timerEnds,
        lastUsedAt: now,
      },
    },
    { returnDocument: 'after', runValidators: true },
  )
    .populate({ path: 'floor', select: 'label floorNumber' })
    .populate({
      path: 'currentUser',
      populate: [
        { path: 'userId', select: 'name' },
        { path: 'roomId', select: 'roomNumber' },
      ],
    })
    .lean();

  if (!machine) {
    return conflict(
      c,
      'This washing machine is already in use or unavailable',
      'MACHINE_NOT_AVAILABLE',
    );
  }

  return c.json({
    success: true,
    data: mapMachine(machine as unknown as Record<string, unknown>),
    meta: { timerEndsAt: timerEnds.toISOString() },
  });
});

// ── POST /washing-machines/:id/release — tenant / admin releases ──
washingMachines.post('/:id/release', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid machine ID');

  const user = c.get('user');

  const machine = await WashingMachine.findById(id);
  if (!machine) return notFound(c, 'Washing machine');

  if (machine.status !== 'in_use') {
    return badRequest(c, 'Machine is not currently in use', 'NOT_IN_USE');
  }

  // Ownership check: tenant can only release their own claim
  if (user.role === 'tenant') {
    const tenant = await Tenant.findOne(safeFilter({ userId: user.sub })).lean();
    if (!tenant || String(machine.currentUserId) !== String(tenant._id)) {
      return badRequest(c, 'You can only release your own claim', 'NOT_YOUR_CLAIM');
    }
  } else if (user.role !== 'admin') {
    return badRequest(c, 'Not allowed', 'FORBIDDEN');
  }

  machine.status = 'available';
  machine.currentUserId = null;
  machine.claimedAt = null;
  machine.timerEndsAt = null;
  await machine.save();

  const populated = await WashingMachine.findById(machine._id)
    .populate({ path: 'floor', select: 'label floorNumber' })
    .populate({
      path: 'currentUser',
      populate: [
        { path: 'userId', select: 'name' },
        { path: 'roomId', select: 'roomNumber' },
      ],
    })
    .lean();

  return c.json({
    success: true,
    data: mapMachine(populated as unknown as Record<string, unknown>),
  });
});

// ── DELETE /washing-machines/:id ──────────────────────
washingMachines.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid machine ID');

  const machine = await WashingMachine.findByIdAndDelete(id);
  if (!machine) return notFound(c, 'Washing machine');

  await writeAuditLog({
    userId: c.get('user').sub,
    action: 'delete',
    resource: 'washing_machine',
    resourceId: id,
    details: { machineNumber: machine.machineNumber },
  });

  return c.json({ success: true, data: { message: 'Washing machine deleted' } });
});

export default washingMachines;
