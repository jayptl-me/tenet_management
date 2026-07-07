import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, conflict, parseId } from '../lib/routeUtils.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';

const floors = new Hono();

// ── Schemas ─────────────────────────────────────────────
const amenityCountSchema = z.strictObject({
  amenityKey: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Must be a valid amenity key'),
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

  try {
    const floor = await Floor.create(body);
    return c.json({ success: true, data: floor }, 201);
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      return conflict(c, `Floor number ${body.floorNumber} already exists`, 'DUPLICATE_FLOOR');
    }
    throw err;
  }
});

// ── PUT /floors/:id ─────────────────────────────────────
floors.put('/:id', authGuard, adminOnly, zValidator('json', updateFloorSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid floor ID');

  const body = c.req.valid('json');

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

  const roomCount = await Room.countDocuments({ floorId: id } as Record<string, unknown>);
  if (roomCount > 0) {
    return conflict(
      c,
      `Cannot delete floor with ${roomCount} rooms. Remove rooms first.`,
      'FLOOR_HAS_ROOMS',
    );
  }

  const floor = await Floor.findByIdAndDelete(id);
  if (!floor) return notFound(c, 'Floor');

  return c.json({ success: true, data: { message: 'Floor deleted' } });
});

export default floors;
