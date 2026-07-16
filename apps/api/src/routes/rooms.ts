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

// ── Helpers ───────────────────────────────────────────────

const BED_IDS = ['A', 'B', 'C', 'D'] as const;

type BedSnap = { bedId: string; isOccupied: boolean; tenantId: unknown };

/** Recount active rooms for one or more floors (findByIdAndUpdate skips post-save). */
async function recomputeFloorTotalRooms(...floorIds: Array<string | unknown | null | undefined>) {
  const seen = new Set<string>();
  for (const raw of floorIds) {
    if (raw == null) continue;
    const id = String(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    try {
      const count = await Room.countDocuments(
        { floorId: id, isActive: true } as Record<string, unknown>,
      );
      await Floor.findByIdAndUpdate(id, { totalRooms: count });
    } catch {
      // Non-fatal accounting
    }
  }
}
type BedRemap = { tenantId: string; fromBedId: string; toBedId: string };

/**
 * Rebuild beds when sharingType changes.
 * Packs occupied tenants into slots A..N (preserving occupancy), fills free slots,
 * and returns remaps when a tenant must move (e.g. only bed C occupied on 3→2).
 * Throws BEDS_OCCUPIED_ON_DOWNSIZE if occupied count exceeds new sharing type.
 */
function rebuildBedsForSharingType(
  existingBeds: BedSnap[],
  newSharingType: number,
): { beds: BedSnap[]; remaps: BedRemap[] } {
  const occupied = existingBeds
    .filter((b) => b.isOccupied)
    .sort((a, b) => a.bedId.localeCompare(b.bedId));
  const slots = BED_IDS.slice(0, newSharingType);

  if (occupied.length > newSharingType) {
    throw Object.assign(
      new Error(
        `Cannot change sharing type from ${existingBeds.length} to ${newSharingType}: ${occupied.length} bed(s) are still occupied. Check out tenants first.`,
      ),
      { code: 'BEDS_OCCUPIED_ON_DOWNSIZE' },
    );
  }

  // Pack occupied tenants into the first N letter slots so none are truncated.
  const remaps: BedRemap[] = [];
  const beds: BedSnap[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slotId = slots[i]!;
    const occ = occupied[i];
    if (occ) {
      if (String(occ.bedId) !== slotId && occ.tenantId) {
        remaps.push({
          tenantId: String(occ.tenantId),
          fromBedId: String(occ.bedId),
          toBedId: slotId,
        });
      }
      beds.push({ bedId: slotId, isOccupied: true, tenantId: occ.tenantId });
    } else {
      beds.push({ bedId: slotId, isOccupied: false, tenantId: null });
    }
  }

  return { beds, remaps };
}

// ── Router ───────────────────────────────────────────────

const router = new Hono();

// GET / — paginated list with filters
router.get('/', authGuard, async (c) => {
  const { page, limit } = parsePagination(c);
  const floorId = c.req.query('floorId');
  const sharingType = c.req.query('sharingType');
  const isActive = c.req.query('isActive');
  const roomNumber = c.req.query('roomNumber');

  const filter: Record<string, unknown> = {};
  if (floorId) filter.floorId = floorId;
  if (sharingType) filter.sharingType = Number(sharingType);
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (roomNumber) filter.roomNumber = { $regex: roomNumber, $options: 'i' };

  const sortParam = c.req.query('sort') ?? '-createdAt';
  const orderParam = c.req.query('order') ?? 'desc';
  const order = orderParam === 'asc' ? 1 : sortParam.startsWith('-') ? -1 : 1;
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

  // If sharingType changes, rebuild beds array to match
  if (body.sharingType !== undefined) {
    const existingRoom = await Room.findById(id);
    if (!existingRoom) return notFound(c, 'Room');

    const oldSharingType = existingRoom.sharingType;
    const newSharingType = body.sharingType;

    if (oldSharingType !== newSharingType) {
      try {
        const { beds: rebuiltBeds, remaps } = rebuildBedsForSharingType(
          existingRoom.beds.map((b) => ({
            bedId: b.bedId,
            isOccupied: b.isOccupied,
            tenantId: b.tenantId,
          })),
          newSharingType,
        );

        // Apply all changes atomically via findOneAndUpdate
        // to prevent race conditions on concurrent sharingType changes.
        // We must first validate via rebuildBedsForSharingType above
        // (which throws on occupied downsize), then apply the update
        // in a single atomic operation keyed on the current sharingType.
        const updateData: Record<string, unknown> = {
          sharingType: newSharingType,
          beds: rebuiltBeds,
          occupancyCount: rebuiltBeds.filter((b) => b.isOccupied).length,
        };
        if (body.roomNumber !== undefined) updateData.roomNumber = body.roomNumber;
        if (body.floorId !== undefined) updateData.floorId = body.floorId;
        if (body.monthlyRent !== undefined) updateData.monthlyRent = body.monthlyRent;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.photos !== undefined) updateData.photos = body.photos;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.roomAmenities !== undefined) updateData.roomAmenities = body.roomAmenities;

        const previousFloorId = existingRoom.floorId;
        const updated = await Room.findOneAndUpdate(
          { _id: id, sharingType: oldSharingType },
          updateData,
          { returnDocument: 'after', runValidators: true },
        );
        if (!updated) {
          return conflict(
            c,
            'Room sharing type was changed by another admin. Please reload and try again.',
            'CONCURRENT_MODIFICATION',
          );
        }

        // Keep Tenant.bedId in sync when packing moved occupants (e.g. C→A).
        if (remaps.length > 0) {
          await Promise.all(
            remaps.map((r) => Tenant.findByIdAndUpdate(r.tenantId, { bedId: r.toBedId }).exec()),
          );
        }

        await recomputeFloorTotalRooms(previousFloorId, updated.floorId);

        await updated.populate('floor');

        return c.json({ success: true, data: updated });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e?.code === 'BEDS_OCCUPIED_ON_DOWNSIZE') {
          return conflict(
            c,
            e.message ?? 'Cannot reduce sharing type while beds are occupied',
            'BEDS_OCCUPIED_ON_DOWNSIZE',
          );
        }
        throw err;
      }
    }
  }

  // No sharingType change — standard partial update
  const before = await Room.findById(id).lean();
  if (!before) return notFound(c, 'Room');

  const room = await Room.findByIdAndUpdate(id, body, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('floor')
    .lean();

  if (!room) return notFound(c, 'Room');

  // findByIdAndUpdate skips post-save; recount floors when floor or active flag moves.
  if (body.floorId !== undefined || body.isActive !== undefined) {
    await recomputeFloorTotalRooms(
      (before as { floorId?: unknown }).floorId,
      (room as { floorId?: unknown }).floorId,
    );
  }

  return c.json({ success: true, data: room });
});

// DELETE /:id — soft delete room (admin only)
router.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid room ID');

  // Only block if active tenants still occupy this room
  const activeCount = await Tenant.countDocuments({
    roomId: id,
    isActive: true,
  } as Record<string, unknown>);

  if (activeCount > 0) {
    return conflict(
      c,
      `Cannot delete room: ${activeCount} active tenant(s) still occupy this room. Please check them out first.`,
      'ACTIVE_TENANTS',
    );
  }

  const room = await Room.findByIdAndUpdate(
    id,
    { isActive: false },
    { returnDocument: 'after' },
  ).lean();

  if (!room) return notFound(c, 'Room');

  // Soft-delete skips document middleware; recompute Floor.totalRooms explicitly
  await recomputeFloorTotalRooms((room as { floorId?: unknown }).floorId);

  return c.json({ success: true, data: room });
});

export default router;
