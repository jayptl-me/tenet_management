import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, conflict, parseId, safeFilter } from '../lib/routeUtils.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { AppConfig } from '../models/appConfig.js';
import { ServiceStatus } from '../models/serviceStatus.js';

const floors = new Hono();

/**
 * Seed ServiceStatus rows for every isPerFloor amenity definition on a floor.
 * Idempotent: skips keys that already exist for the floor (unique floorId+serviceType).
 */
async function seedFloorServiceStatuses(
  floorId: mongoose.Types.ObjectId | string,
  updatedByUserId: string,
): Promise<number> {
  const config = await AppConfig.findOne().select('amenityDefinitions').lean();
  const definitions = config?.amenityDefinitions ?? [];
  const perFloorKeys = definitions
    .filter((d) => d.isPerFloor === true && typeof d.key === 'string' && d.key.length > 0)
    .map((d) => d.key);

  if (perFloorKeys.length === 0) return 0;

  const floorOid =
    typeof floorId === 'string' ? new mongoose.Types.ObjectId(floorId) : floorId;
  const existing = await ServiceStatus.find(safeFilter({ floorId: floorOid }))
    .select('serviceType')
    .lean();
  const existingKeys = new Set(existing.map((e) => e.serviceType));
  const toCreate = perFloorKeys.filter((k) => !existingKeys.has(k));
  if (toCreate.length === 0) return 0;

  const lastUpdatedBy = new mongoose.Types.ObjectId(updatedByUserId);
  type CreateMany = (docs: Record<string, unknown>[], opts?: { ordered?: boolean }) => Promise<unknown>;
  const insertMany = ServiceStatus.insertMany.bind(ServiceStatus) as unknown as CreateMany;
  await insertMany(
    toCreate.map((serviceType) => ({
      floorId: floorOid,
      serviceType,
      status: 'operational',
      lastUpdatedBy,
      lastUpdatedAt: new Date(),
      note: '',
    })),
    { ordered: false },
  );
  return toCreate.length;
}

// ── Schemas ─────────────────────────────────────────────
const amenityCountSchema = z.strictObject({
  amenityKey: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'Must be a valid amenity key'),
  count: z.number().int().min(0).max(10),
});

const createFloorSchema = z.strictObject({
  floorNumber: z.number().int().min(0, 'Floor number must be 0 or greater'),
  label: z.string().min(1, 'Label is required').max(50, 'Label too long'),
  totalRooms: z.number().int().min(1, 'Must have at least 1 room').max(50, 'Max 50 rooms'),
  amenityCounts: z.array(amenityCountSchema).optional(),
  amenities: z
    .object({
      washingMachines: z.number().int().min(0).max(5).optional(),
      fridges: z.number().int().min(0).max(5).optional(),
    })
    .optional(),
});

const updateFloorSchema = createFloorSchema.partial();

// ── GET /floors ─────────────────────────────────────────
floors.get('/', authGuard, async (c) => {
  const data = await Floor.find().sort({ floorNumber: 1 }).lean();
  return c.json({ success: true, data });
});

// ── GET /floors/:id ─────────────────────────────────────
floors.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  const floor = await Floor.findById(id).lean();
  if (!floor) return notFound(c, 'Floor');

  return c.json({ success: true, data: floor });
});

// ── POST /floors ────────────────────────────────────────
floors.post('/', authGuard, adminOnly, zValidator('json', createFloorSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  try {
    const floor = await Floor.create(body);
    // FL-1 / SV-2: auto-seed ServiceStatus for isPerFloor amenity definitions
    try {
      await seedFloorServiceStatuses(
        (floor as { _id: mongoose.Types.ObjectId })._id,
        user.sub,
      );
    } catch {
      // Non-fatal: floor exists; admin can still add services manually
    }
    return c.json({ success: true, data: floor }, 201);
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return conflict(c, 'A floor with this number or label already exists', 'DUPLICATE_FLOOR');
    }
    throw err;
  }
});

// ── PUT /floors/:id ─────────────────────────────────────
floors.put('/:id', authGuard, adminOnly, zValidator('json', updateFloorSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  const body = c.req.valid('json');

  // Strip totalRooms — auto-synced by Room.post('save') hook
  delete (body as Record<string, unknown>).totalRooms;

  try {
    const floor = await Floor.findByIdAndUpdate(id, body, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();
    if (!floor) return notFound(c, 'Floor');
    return c.json({ success: true, data: floor });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return conflict(c, 'Floor number already taken', 'DUPLICATE_FLOOR');
    }
    throw err;
  }
});

// ── DELETE /floors/:id ──────────────────────────────────
floors.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  // Only active rooms block hard-delete. Soft-deleted rooms are ignored so
  // floors can be cleaned up after all rooms were deactivated.
  const roomCount = await Room.countDocuments({
    floorId: id,
    isActive: true,
  } as Record<string, unknown>);
  if (roomCount > 0) {
    return conflict(
      c,
      `Cannot delete floor with ${roomCount} active room(s). Deactivate or move rooms first.`,
      'FLOOR_HAS_ROOMS',
    );
  }

  const floor = await Floor.findByIdAndDelete(id);
  if (!floor) return notFound(c, 'Floor');

  // Cascade ServiceStatus rows for this floor (no rooms remain)
  await ServiceStatus.deleteMany(
    safeFilter({ floorId: new mongoose.Types.ObjectId(id) }),
  );

  return c.json({ success: true, data: { message: 'Floor deleted' } });
});

export default floors;
