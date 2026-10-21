import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { Asset } from '../models/asset.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { writeAuditLog } from '../lib/write-audit-log.js';
import { createNotification } from '../services/notification.service.js';
import { logger } from '../lib/logger.js';
import mongoose from 'mongoose';

const assets = new Hono();

// ── Cast helper for Mongoose 9 ──────────────────────────
type CreateFn = (doc: Record<string, unknown>) => Promise<unknown>;
const assetCreate = Asset.create.bind(Asset) as unknown as CreateFn;

// ── Schemas ─────────────────────────────────────────────
/** Accept ISO datetime or YYYY-MM-DD; store as Date. */
const optionalDateString = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

const createAssetSchema = z.strictObject({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name cannot exceed 120 characters'),
  category: z.enum(['furniture', 'appliance', 'electronics', 'cleaning', 'other']),
  location: z
    .string()
    .min(1, 'Location is required')
    .max(160, 'Location cannot exceed 160 characters'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  lowStockThreshold: z.number().int().min(0, 'Threshold cannot be negative').default(0),
  status: z
    .enum(['available', 'in_use', 'under_maintenance', 'damaged', 'retired'])
    .default('available'),
  purchasedDate: optionalDateString,
  lastServicedDate: optionalDateString,
  nextServiceDate: optionalDateString,
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  floorId: z.string().min(1).optional().or(z.literal('')),
  roomId: z.string().min(1).optional().or(z.literal('')),
});

const updateAssetSchema = createAssetSchema.partial();

function toDateOrUndefined(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ── Resident notifications ────────────────────────────────
// An asset that goes out of service is the residents' problem: the geyser in
// their room stops working. The recipient is the set of residents the asset is
// attached to (its room, or its floor when it hangs on a floor), resolved
// from the asset record itself, never from a client-supplied id. A failed push
// is logged and never undoes the write it follows.

/** The asset statuses that take an item out of service for the residents. */
const OUT_OF_SERVICE_STATUSES = new Set(['under_maintenance', 'damaged']);

/** What a resident hears about an asset that went out of service. */
function assetStatusSentence(status: string): string {
  if (status === 'under_maintenance') return 'is being repaired';
  if (status === 'damaged') return 'is broken';
  return 'is out of service';
}

/**
 * Tells the residents an asset belongs to that the asset went out of service.
 *
 * The recipients are the residents of the room the asset sits in, or of the
 * floor when the asset hangs on a floor. An asset with nobody attached to it
 * has nobody to tell, so nothing is sent and the reason is logged.
 */
async function notifyAssetOutOfService(asset: {
  _id: unknown;
  name: string;
  status: string;
  roomId: unknown;
  floorId: unknown;
  location: string;
}): Promise<void> {
  try {
    const roomId = asset.roomId ? String(asset.roomId) : '';
    const floorId = asset.floorId ? String(asset.floorId) : '';

    let userIds: string[] = [];
    let place = asset.location;

    if (roomId !== '') {
      const room = await Room.findById(roomId).select('roomNumber').lean();
      place = String((room as { roomNumber?: string } | null)?.roomNumber ?? asset.location);
      const tenants = await Tenant.find(
        safeFilter({ roomId: new mongoose.Types.ObjectId(roomId), isActive: true }),
      )
        .select('userId')
        .lean();
      userIds = [
        ...new Set(
          (tenants as unknown as Array<{ userId?: unknown }>)
            .map((tenant) => String(tenant.userId ?? ''))
            .filter((id) => id !== ''),
        ),
      ];
    } else if (floorId !== '') {
      const floor = await Floor.findById(floorId).select('label').lean();
      place = String((floor as { label?: string } | null)?.label ?? asset.location);
      const rooms = await Room.find(safeFilter({ floorId: new mongoose.Types.ObjectId(floorId) }))
        .select('_id')
        .lean();
      const roomIds = (rooms as unknown as Array<{ _id?: unknown }>).map((room) =>
        String(room._id ?? ''),
      );
      const tenants = await Tenant.find(safeFilter({ roomId: { $in: roomIds }, isActive: true }))
        .select('userId')
        .lean();
      userIds = [
        ...new Set(
          (tenants as unknown as Array<{ userId?: unknown }>)
            .map((tenant) => String(tenant.userId ?? ''))
            .filter((id) => id !== ''),
        ),
      ];
    }

    if (userIds.length === 0) {
      logger.warn(
        { asset: asset.name },
        'Asset notification skipped: no resident is attached to the asset',
      );
      return;
    }

    await createNotification({
      targetType: 'individual',
      targetIds: userIds,
      title: 'Asset out of service',
      body: `The ${asset.name} in ${place} ${assetStatusSentence(asset.status)}.`,
      type: 'service_update',
      data: { assetId: String(asset._id ?? ''), assetName: asset.name },
      sendPush: true,
    });
  } catch (err) {
    logger.error({ err, asset: asset.name }, 'Failed to notify residents about an asset');
  }
}

// ── GET /assets ─────────────────────────────────────────
assets.get('/', authGuard, adminOnly, async (c) => {
  const { page, limit, skip } = parsePagination(c);
  const category = c.req.query('category');
  const status = c.req.query('status');
  const search = c.req.query('search');

  const filter: Record<string, unknown> = {};
  if (category) {
    if (!['furniture', 'appliance', 'electronics', 'cleaning', 'other'].includes(category)) {
      return badRequest(c, 'Invalid category filter', 'INVALID_CATEGORY');
    }
    filter.category = category;
  }
  if (status) {
    if (!['available', 'in_use', 'under_maintenance', 'damaged', 'retired'].includes(status)) {
      return badRequest(c, 'Invalid status filter', 'INVALID_STATUS');
    }
    filter.status = status;
  }
  if (search) {
    const escaped = String(search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { location: { $regex: escaped, $options: 'i' } },
      { notes: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Asset.find(filter)
      .sort({ category: 1, name: 1 } as Record<string, 1 | -1>)
      .skip(skip)
      .limit(limit)
      .populate('floorId', 'label floorNumber')
      .populate('roomId', 'roomNumber')
      .lean(),
    Asset.countDocuments(filter as Record<string, unknown>),
  ]);

  return c.json({
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── GET /assets/low-stock ───────────────────────────────
assets.get('/low-stock', authGuard, adminOnly, async (c) => {
  const data = await Asset.find({
    lowStockThreshold: { $gt: 0 },
    $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
  })
    .sort({ category: 1, name: 1 } as Record<string, 1 | -1>)
    .lean();

  return c.json({ success: true, data });
});

// ── GET /assets/service-due ──────────────────────────────
assets.get('/service-due', authGuard, adminOnly, async (c) => {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const data = await Asset.find({
    nextServiceDate: { $ne: null, $lte: thirtyDaysFromNow },
    status: { $ne: 'retired' },
  } as Record<string, unknown>)
    .sort({ nextServiceDate: 1 } as Record<string, 1 | -1>)
    .lean();

  return c.json({ success: true, data });
});

// ── GET /assets/:id ─────────────────────────────────────
assets.get('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid asset ID');

  const asset = await Asset.findById(id)
    .populate('floorId', 'label floorNumber')
    .populate('roomId', 'roomNumber')
    .lean();
  if (!asset) return notFound(c, 'Asset');

  return c.json({ success: true, data: asset });
});

// ── POST /assets ────────────────────────────────────────
assets.post('/', authGuard, adminOnly, zValidator('json', createAssetSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  const created = await assetCreate({
    name: body.name,
    category: body.category,
    location: body.location,
    floorId: body.floorId ? new mongoose.Types.ObjectId(body.floorId) : null,
    roomId: body.roomId ? new mongoose.Types.ObjectId(body.roomId) : null,
    quantity: body.quantity,
    lowStockThreshold: body.lowStockThreshold,
    status: body.status,
    purchasedDate: toDateOrUndefined(body.purchasedDate) ?? null,
    lastServicedDate: toDateOrUndefined(body.lastServicedDate) ?? null,
    nextServiceDate: toDateOrUndefined(body.nextServiceDate) ?? null,
    notes: body.notes ?? '',
  });
  const asset = created as unknown as Record<string, unknown> & {
    name: string;
    category: string;
    quantity: number;
  };

  void writeAuditLog({
    userId: user.sub,
    action: 'create',
    resource: 'asset',
    resourceId: String((created as unknown as Record<string, unknown>)._id),
    details: {
      name: asset.name,
      category: asset.category,
      quantity: asset.quantity,
    },
  });

  return c.json({ success: true, data: asset }, 201);
});

// ── PUT /assets/:id ─────────────────────────────────────
assets.put('/:id', authGuard, adminOnly, zValidator('json', updateAssetSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid asset ID');

  const body = c.req.valid('json');
  const user = c.get('user');
  // The status before the edit: only a status that actually moved is a
  // decision the residents have to hear about.
  const before = await Asset.findById(id).lean();
  if (!before) return notFound(c, 'Asset');

  const update: Record<string, unknown> = { ...body };
  if (body.floorId !== undefined) {
    update.floorId = body.floorId ? new mongoose.Types.ObjectId(body.floorId) : null;
  }
  if (body.roomId !== undefined) {
    update.roomId = body.roomId ? new mongoose.Types.ObjectId(body.roomId) : null;
  }
  if (body.purchasedDate !== undefined) {
    update.purchasedDate = toDateOrUndefined(body.purchasedDate) ?? null;
  }
  if (body.lastServicedDate !== undefined) {
    update.lastServicedDate = toDateOrUndefined(body.lastServicedDate) ?? null;
  }
  if (body.nextServiceDate !== undefined) {
    update.nextServiceDate = toDateOrUndefined(body.nextServiceDate) ?? null;
  }

  const asset = await Asset.findByIdAndUpdate(id, update, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();

  if (!asset) return notFound(c, 'Asset');

  void writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'asset',
    resourceId: id,
    details: {
      updatedFields: Object.keys(body),
    },
  });

  // The item the residents live with just went out of service: they must
  // hear it from the server, not discover it when the geyser stops.
  const newStatus = String((asset as { status?: string }).status ?? '');
  const previousStatus = String((before as { status?: string }).status ?? '');
  if (OUT_OF_SERVICE_STATUSES.has(newStatus) && newStatus !== previousStatus) {
    await notifyAssetOutOfService({
      _id: (asset as { _id?: unknown })._id,
      name: String((asset as { name?: string }).name ?? 'An item'),
      status: newStatus,
      roomId: (asset as { roomId?: unknown }).roomId,
      floorId: (asset as { floorId?: unknown }).floorId,
      location: String((asset as { location?: string }).location ?? ''),
    });
  }

  return c.json({ success: true, data: asset });
});

// ── DELETE /assets/:id ──────────────────────────────────
assets.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid asset ID');
  const user = c.get('user');

  const asset = await Asset.findByIdAndUpdate(
    id,
    { status: 'retired' },
    { returnDocument: 'after' },
  ).lean();

  if (!asset) return notFound(c, 'Asset');

  void writeAuditLog({
    userId: user.sub,
    action: 'update',
    resource: 'asset',
    resourceId: id,
    details: {
      name: asset.name,
      retired: true,
      previousStatus: 'active',
      status: 'retired',
    },
  });

  return c.json({ success: true, data: { message: 'Asset retired' } });
});

export default assets;
