import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, conflict, parseId, safeFilter } from '../lib/routeUtils.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { WashingMachine } from '../models/washingMachine.js';
import { AppConfig } from '../models/appConfig.js';
import { ServiceStatus } from '../models/serviceStatus.js';
import { Complaint } from '../models/complaint.js';
import { writeAuditLog } from '../lib/write-audit-log.js';

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

  const floorOid = typeof floorId === 'string' ? new mongoose.Types.ObjectId(floorId) : floorId;
  const existing = await ServiceStatus.find(safeFilter({ floorId: floorOid }))
    .select('serviceType')
    .lean();
  const existingKeys = new Set(existing.map((e) => e.serviceType));
  const toCreate = perFloorKeys.filter((k) => !existingKeys.has(k));
  if (toCreate.length === 0) return 0;

  const lastUpdatedBy = new mongoose.Types.ObjectId(updatedByUserId);
  type CreateMany = (
    docs: Record<string, unknown>[],
    opts?: { ordered?: boolean },
  ) => Promise<unknown>;
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

// ── GET /floors/overview — one-shot per-floor stats for the floors board ──
// Registered before /:id. Server-side aggregation replaces the client's
// rooms?limit=500 + services?limit=100 double fetch (both truncate on
// larger datasets and force the UI to recompute bed math).
floors.get('/overview', authGuard, async (c) => {
  const [allFloors, allRooms, serviceRows] = await Promise.all([
    Floor.find().sort({ floorNumber: 1 }).lean(),
    Room.find().select('floorId roomNumber sharingType monthlyRent isActive beds').lean(),
    ServiceStatus.find().select('floorId status').lean(),
  ]);

  // roomId -> floorId map so open complaints can be attributed to floors
  const floorByRoom = new Map<string, string>();
  for (const r of allRooms as unknown as Array<{ _id: unknown; floorId: unknown }>) {
    floorByRoom.set(String(r._id), String(r.floorId));
  }

  const openComplaints = await Complaint.aggregate([
    { $match: { status: { $in: ['open', 'in_progress'] } } },
    { $group: { _id: '$roomId', n: { $sum: 1 } } },
  ]);
  const complaintsByFloor = new Map<string, number>();
  for (const row of openComplaints as Array<{ _id: unknown; n: number }>) {
    const fid = floorByRoom.get(String(row._id));
    if (fid) complaintsByFloor.set(fid, (complaintsByFloor.get(fid) ?? 0) + row.n);
  }

  const servicesByFloor = new Map<
    string,
    { operational: number; degraded: number; down: number }
  >();
  for (const s of serviceRows as unknown as Array<{ floorId: unknown; status: string }>) {
    const fid = String(s.floorId);
    const bucket = servicesByFloor.get(fid) ?? { operational: 0, degraded: 0, down: 0 };
    if (s.status === 'operational') bucket.operational += 1;
    else if (s.status === 'degraded') bucket.degraded += 1;
    else if (s.status === 'down') bucket.down += 1;
    servicesByFloor.set(fid, bucket);
  }

  const roomsByFloor = new Map<string, Array<Record<string, unknown>>>();
  for (const room of allRooms as unknown as Array<Record<string, unknown>>) {
    const fid = String(room.floorId);
    const list = roomsByFloor.get(fid) ?? [];
    list.push(room);
    roomsByFloor.set(fid, list);
  }

  const data = (allFloors as unknown as Array<Record<string, unknown>>).map((floor) => {
    const fid = String(floor._id);
    const rooms = roomsByFloor.get(fid) ?? [];
    const activeRooms = rooms.filter((r) => r.isActive !== false);
    const beds = activeRooms.flatMap((r) =>
      ((r.beds as Array<{ bedId: string; isOccupied: boolean }> | undefined) ?? []).map((b) => ({
        bedId: b.bedId,
        isOccupied: b.isOccupied,
      })),
    );
    const occupiedBeds = beds.filter((b) => b.isOccupied).length;
    const services = servicesByFloor.get(fid) ?? { operational: 0, degraded: 0, down: 0 };
    return {
      ...floor,
      stats: {
        activeRooms: activeRooms.length,
        totalBeds: beds.length,
        occupiedBeds,
        vacantBeds: Math.max(0, beds.length - occupiedBeds),
        occupancyPct: beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0,
        potentialRent: activeRooms.reduce((sum, r) => sum + (Number(r.monthlyRent) || 0), 0),
        services: {
          ...services,
          openComplaints: complaintsByFloor.get(fid) ?? 0,
        },
      },
      beds,
    };
  });

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

// ── GET /floors/:id/rooms — rooms + server-side occupancy aggregates ──
// Single source of truth for floor stats so the UI never truncates room
// lists at a client-side fetch limit (beds, occupancy, potential rent exact).
floors.get('/:id/rooms', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  const floor = await Floor.findById(id).lean();
  if (!floor) return notFound(c, 'Floor');

  const rooms = await Room.find(safeFilter({ floorId: id }))
    .sort({ roomNumber: 1 })
    .lean();

  // Enrich occupied beds with tenant names (same contract as GET /rooms list).
  const tenantIds = Array.from(
    new Set(
      (rooms as unknown as Array<{ beds?: Array<{ tenantId?: unknown }> }>)
        .flatMap((r) => r.beds ?? [])
        .map((b) => (b.tenantId ? String(b.tenantId) : ''))
        .filter((tid) => tid !== ''),
    ),
  );
  const tenantNameMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const tenants = await Tenant.find(safeFilter({ _id: { $in: tenantIds } }))
      .populate({ path: 'userId', select: 'name' })
      .lean();
    for (const t of tenants) {
      const doc = t as unknown as { _id: unknown; userId?: { name?: string } | null };
      const name =
        doc?.userId && typeof doc.userId === 'object' ? (doc.userId.name ?? 'Unknown') : 'Unknown';
      tenantNameMap.set(String(doc._id), name);
    }
  }

  const enrichedRooms = (rooms as unknown as Array<Record<string, unknown>>).map((room) => {
    const beds = (room.beds as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      ...room,
      beds: beds.map((bed) => {
        const tid = bed.tenantId ? String(bed.tenantId) : null;
        return { ...bed, tenantName: tid ? (tenantNameMap.get(tid) ?? null) : null };
      }),
    };
  }) as Array<Record<string, unknown>>;

  const activeRooms = enrichedRooms.filter((r) => r.isActive !== false);
  const totalBeds = activeRooms.reduce(
    (sum, r) => sum + ((r.beds as unknown[]).length || Number(r.sharingType) || 0),
    0,
  );
  const occupiedBeds = activeRooms.reduce(
    (sum, r) =>
      (r.beds as Array<{ isOccupied?: boolean }>).filter((b) => b.isOccupied).length + sum,
    0,
  );
  const potentialRent = activeRooms.reduce((sum, r) => sum + (Number(r.monthlyRent) || 0), 0);

  return c.json({
    success: true,
    data: {
      floor,
      rooms: enrichedRooms,
      stats: {
        activeRooms: activeRooms.length,
        inactiveRooms: enrichedRooms.length - activeRooms.length,
        totalBeds,
        occupiedBeds,
        vacantBeds: Math.max(0, totalBeds - occupiedBeds),
        occupancyPct: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
        potentialRent,
      },
    },
  });
});

// ── POST /floors ────────────────────────────────────────
floors.post('/', authGuard, adminOnly, zValidator('json', createFloorSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  try {
    const floor = await Floor.create(body);
    // FL-1 / SV-2: auto-seed ServiceStatus for isPerFloor amenity definitions
    try {
      await seedFloorServiceStatuses((floor as { _id: mongoose.Types.ObjectId })._id, user.sub);
    } catch {
      // Non-fatal: floor exists; admin can still add services manually
    }

    writeAuditLog({
      userId: user.sub,
      action: 'create',
      resource: 'floor',
      resourceId: (floor as { _id: mongoose.Types.ObjectId })._id.toString(),
      details: {
        floorNumber: floor.floorNumber,
        label: floor.label,
        totalRooms: floor.totalRooms,
      },
    });

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
  const user = c.get('user');

  // Strip totalRooms — auto-synced by Room.post('save') hook
  delete (body as Record<string, unknown>).totalRooms;

  try {
    const floor = await Floor.findByIdAndUpdate(id, body, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();
    if (!floor) return notFound(c, 'Floor');

    writeAuditLog({
      userId: user.sub,
      action: 'update',
      resource: 'floor',
      resourceId: id,
      details: {
        updatedFields: Object.keys(body),
      },
    });

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
  const user = c.get('user');

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

  // Active washing machines on this floor block hard-delete
  const machineCount = await WashingMachine.countDocuments(
    safeFilter({ floorId: new mongoose.Types.ObjectId(id) }),
  );
  if (machineCount > 0) {
    return conflict(
      c,
      `Cannot delete floor with ${machineCount} washing machine(s). Remove or reassign machines first.`,
      'FLOOR_HAS_MACHINES',
    );
  }

  const floor = await Floor.findByIdAndDelete(id);
  if (!floor) return notFound(c, 'Floor');

  // Cascade ServiceStatus rows for this floor (no rooms remain)
  await ServiceStatus.deleteMany(safeFilter({ floorId: new mongoose.Types.ObjectId(id) }));

  writeAuditLog({
    userId: user.sub,
    action: 'delete',
    resource: 'floor',
    resourceId: id,
    details: {
      floorNumber: floor.floorNumber,
      label: floor.label,
    },
  });

  return c.json({ success: true, data: { message: 'Floor deleted' } });
});

// ── POST /floors/reseed-services — backfill missing ServiceStatus rows ──
// Covers new isPerFloor amenity keys added to AppConfig after floors existed.
// Idempotent: only creates keys missing per floor.
floors.post('/reseed-services', authGuard, adminOnly, async (c) => {
  const user = c.get('user');
  const allFloors = await Floor.find().select('_id label').lean();

  let floorsTouched = 0;
  let rowsCreated = 0;
  for (const floor of allFloors) {
    const created = await seedFloorServiceStatuses(String(floor._id), user.sub);
    if (created > 0) {
      floorsTouched += 1;
      rowsCreated += created;
    }
  }

  await writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'floor',
    resourceId: 'all',
    details: { reseededServices: true, floorsTouched, rowsCreated },
  });

  return c.json({ success: true, data: { floorsTouched, rowsCreated } });
});

export default floors;
