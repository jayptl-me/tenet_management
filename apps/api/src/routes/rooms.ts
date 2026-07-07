import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Room } from '../models/room.js';
import { Floor } from '../models/floor.js';
import { Tenant } from '../models/tenant.js';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import {
  parsePagination,
  parseId,
  notFound,
  badRequest,
  conflict,
  safeFilter,
} from '../lib/routeUtils.js';

// ── Zod Schemas ──────────────────────────────────────────

const roomAmenitySchema = z.strictObject({
  amenityKey: z.string().min(1),
  status: z.enum(['operational', 'degraded', 'down']),
});

const createRoomSchema = z.strictObject({
  roomNumber: z.string().trim().min(1).max(20).toUpperCase(),
  floorId: z.string().min(1, 'Floor ID is required'),
  sharingType: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  monthlyRent: z.number().min(1000).max(50000),
  description: z.string().trim().max(500).optional(),
  photos: z.array(z.string().url()).optional(),
  roomAmenities: z.array(roomAmenitySchema).optional(),
});

const updateRoomSchema = z.strictObject({
  roomNumber: z.string().trim().min(1).max(20).toUpperCase().optional(),
  floorId: z.string().min(1).optional(),
  sharingType: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  monthlyRent: z.number().min(1000).max(50000).optional(),
  description: z.string().trim().max(500).optional(),
  photos: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
  roomAmenities: z.array(roomAmenitySchema).optional(),
});

// ── Router ───────────────────────────────────────────────

const router = new Hono();

// GET / — paginated list with filters
router.get('/', authGuard, async (c) => {
  const { page, limit } = parsePagination(c);
  const floorId = c.req.query('floorId');
  const sharingType = c.req.query('sharingType');
  const isActive = c.req.query('isActive');

  const filter: Record<string, unknown> = {};
  if (floorId) filter.floorId = floorId;
  if (sharingType) filter.sharingType = Number(sharingType);
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const sortParam = c.req.query('sort') ?? '-createdAt';
  const order = sortParam.startsWith('-') ? -1 : 1;
  const sortField = sortParam.startsWith('-') ? sortParam.slice(1) : sortParam;
  const sort: Record<string, 1 | -1> = { [sortField]: order };

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Room.find(filter).sort(sort).skip(skip).limit(limit).populate('floor').lean(),
    Room.countDocuments(filter as Record<string, unknown>),
  ]);

  return c.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// GET /available — rooms with vacant beds
router.get('/available', authGuard, async (c) => {
  const rooms = await Room.find({
    isActive: true,
    'beds.isOccupied': false,
  })
    .populate('floor')
    .lean();

  return c.json({ success: true, data: rooms });
});

// GET /:id — single room with populated bed tenant names
router.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid room ID');

  const room = await Room.findById(id).populate('floor').lean();
  if (!room) return notFound(c, 'Room');

  // Look up tenant names for occupied beds
  if (room.beds && room.beds.length > 0) {
    const tenantIds = room.beds
      .filter((b: { tenantId?: unknown }) => b.tenantId)
      .map((b: { tenantId: unknown }) => b.tenantId);

    if (tenantIds.length > 0) {
      const tenants = await (
        Tenant as unknown as {
          find: (filter: Record<string, unknown>) => ReturnType<typeof Tenant.find>;
        }
      )
        .find(safeFilter({ _id: { $in: tenantIds } }))
        .populate({ path: 'userId', select: 'name' })
        .lean();

      const tenantNameMap = new Map<string, string>();
      for (const t of tenants) {
        const tenantDoc = t as unknown as { _id: string; userId?: { name?: string } | null };
        const tenantId = tenantDoc._id.toString();
        const userName =
          tenantDoc?.userId && typeof tenantDoc.userId === 'object'
            ? (tenantDoc.userId as { name: string }).name
            : 'Unknown';
        tenantNameMap.set(tenantId, userName);
      }

      (room as unknown as Record<string, unknown>).beds = room.beds.map(
        (bed: { tenantId?: unknown; bedId: string; isOccupied: boolean }) => {
          const bedTenantId = bed.tenantId ? bed.tenantId.toString() : null;
          return {
            ...bed,
            tenantName: bedTenantId ? (tenantNameMap.get(bedTenantId) ?? null) : null,
          };
        },
      );
    }
  }

  return c.json({ success: true, data: room });
});

// POST / — create room (admin only)
router.post('/', authGuard, adminOnly, zValidator('json', createRoomSchema), async (c) => {
  const body = c.req.valid('json');

  // Validate floor exists
  const floor = await Floor.findById(body.floorId).lean();
  if (!floor) {
    return badRequest(c, 'Floor not found', 'FLOOR_NOT_FOUND');
  }

  // Generate beds based on sharing type
  const beds = Room.generateBeds(body.sharingType);

  try {
    const room = await (
      Room as unknown as { create: (doc: Record<string, unknown>) => Promise<unknown> }
    ).create({
      ...body,
      beds,
    });

    return c.json({ success: true, data: room }, 201);
  } catch (err: unknown) {
    // Duplicate key error (roomNumber unique)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      return conflict(c, 'A room with this room number already exists', 'ROOM_NUMBER_EXISTS');
    }
    throw err;
  }
});

// PUT /:id — update room (admin only)
router.put('/:id', authGuard, adminOnly, zValidator('json', updateRoomSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid room ID');

  const body = c.req.valid('json');

  // If floorId is being updated, validate it exists
  if (body.floorId) {
    const floor = await Floor.findById(body.floorId).lean();
    if (!floor) {
      return badRequest(c, 'Floor not found', 'FLOOR_NOT_FOUND');
    }
  }

  const room = await Room.findByIdAndUpdate(id, body, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('floor')
    .lean();

  if (!room) return notFound(c, 'Room');

  return c.json({ success: true, data: room });
});

// DELETE /:id — soft delete room (admin only)
router.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid room ID');

  // Check for active tenants in this room
  const activeTenants = await Tenant.countDocuments({
    roomId: id,
    isActive: true,
  } as Record<string, unknown>);

  if (activeTenants > 0) {
    return conflict(
      c,
      `Cannot delete room: ${activeTenants} active tenant(s) still occupy this room. Please check them out first.`,
      'ACTIVE_TENANTS',
    );
  }

  const room = await Room.findByIdAndUpdate(id, { isActive: false }, { returnDocument: 'after' }).lean();

  if (!room) return notFound(c, 'Room');

  return c.json({ success: true, data: room });
});

export default router;
