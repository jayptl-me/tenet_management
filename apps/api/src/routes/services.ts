import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, conflict, parseId, safeFilter } from '../lib/routeUtils.js';
import { ServiceStatus } from '../models/serviceStatus.js';
import { Complaint } from '../models/complaint.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { AppConfig } from '../models/appConfig.js';
import { writeAuditLog } from '../lib/write-audit-log.js';
import { broadcast } from '../lib/eventBus.js';

// ── Helper: derive complaint categories from AppConfig amenity definitions ──
async function getAmenityComplaintMap(): Promise<Record<string, string[]>> {
  const config = await AppConfig.findOne().select('amenityDefinitions').lean();
  const definitions = config?.amenityDefinitions ?? [];
  const map: Record<string, string[]> = {};
  for (const def of definitions) {
    if (def.applicableComplaintCategories && def.applicableComplaintCategories.length > 0) {
      map[def.key] = def.applicableComplaintCategories;
    }
  }
  return map;
}

// ── Helper: validate serviceType is an isPerFloor amenity definition ──
// Room-only amenities (isPerFloor=false) must not become floor ServiceStatus rows.
async function isValidFloorServiceType(serviceType: string): Promise<boolean> {
  const config = await AppConfig.findOne().select('amenityDefinitions').lean();
  const definitions = config?.amenityDefinitions ?? [];
  return definitions.some((d) => d.key === serviceType && d.isPerFloor === true);
}

// ── Helper: attach complaint counts per service per floor (dynamic, batched) ──
async function enrichWithComplaintCounts(
  services_list: Array<{
    floorId?: { _id: string } | string;
    serviceType: string;
    [key: string]: unknown;
  }>,
): Promise<Array<Record<string, unknown>>> {
  if (services_list.length === 0) return services_list;

  const serviceToCategory = await getAmenityComplaintMap();

  const floorIds = Array.from(
    new Set(
      services_list.map((svc) => {
        const f = svc.floorId;
        return typeof f === 'object' && f?._id ? String(f._id) : typeof f === 'string' ? f : '';
      }),
    ),
  ).filter((id) => id !== '');

  // One query: all rooms on the involved floors, grouped by floor.
  const rooms = await Room.find(safeFilter({ floorId: { $in: floorIds } }))
    .select('_id floorId')
    .lean();
  const roomsByFloor = new Map<string, string[]>();
  for (const r of rooms as unknown as Array<{ _id: unknown; floorId: unknown }>) {
    const f = String(r.floorId);
    const list = roomsByFloor.get(f) ?? [];
    list.push(String(r._id));
    roomsByFloor.set(f, list);
  }
  const allRoomIds = Array.from(roomsByFloor.values()).flat();

  // One aggregate: open complaint counts by (room, category).
  const counts = allRoomIds.length
    ? ((await Complaint.aggregate([
        {
          $match: {
            status: { $in: ['open', 'in_progress'] },
            roomId: { $in: allRoomIds.map((id) => new mongoose.Types.ObjectId(id)) },
          },
        },
        { $group: { _id: { room: '$roomId', cat: '$category' }, n: { $sum: 1 } } },
      ])) as Array<{ _id: { room: unknown; cat: string }; n: number }>)
    : [];
  const countByRoomCat = new Map<string, number>();
  for (const row of counts) {
    countByRoomCat.set(`${String(row._id.room)}:${row._id.cat}`, row.n);
  }

  return services_list.map((svc) => {
    const f = svc.floorId;
    const floorId =
      typeof f === 'object' && f?._id ? String(f._id) : typeof f === 'string' ? f : null;
    if (!floorId) return { ...svc, openComplaintCount: 0 };
    const categories = serviceToCategory[svc.serviceType] ?? [svc.serviceType];
    const roomIds = roomsByFloor.get(floorId) ?? [];
    let openComplaintCount = 0;
    for (const roomId of roomIds) {
      for (const cat of categories) {
        openComplaintCount += countByRoomCat.get(`${roomId}:${cat}`) ?? 0;
      }
    }
    return { ...svc, openComplaintCount };
  });
}

const services = new Hono();

// ── Schema ──────────────────────────────────────────────
const updateServiceSchema = z.strictObject({
  status: z.enum(['operational', 'degraded', 'down']),
  note: z.string().max(500, 'Note cannot exceed 500 characters').optional(),
});

// ── GET /services/summary — count by status (admin) ──
// Registered before /:id so "summary" is not treated as an ObjectId
services.get('/summary', authGuard, adminOnly, async (c) => {
  const results = await ServiceStatus.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const summary: Record<string, number> = { operational: 0, degraded: 0, down: 0 };
  for (const entry of results) {
    summary[entry._id as string] = entry.count;
  }
  return c.json({ success: true, data: summary });
});

// ── GET /services — paginated list (auth) ──
services.get('/', authGuard, async (c) => {
  const filter: Record<string, unknown> = {};

  const floorIdQ = c.req.query('floorId');
  if (floorIdQ) {
    const parsed = parseId(floorIdQ);
    if (!parsed) return badRequest(c, 'Invalid floorId');
    filter.floorId = parsed;
  }

  const statusQ = c.req.query('status');
  if (statusQ) {
    if (!['operational', 'degraded', 'down'].includes(statusQ)) {
      return badRequest(c, 'Invalid status. Must be operational, degraded, or down.');
    }
    filter.status = statusQ;
  }

  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    ServiceStatus.find(safeFilter(filter))
      .sort({ serviceType: 1 } as Record<string, 1>)
      .skip(skip)
      .limit(limit)
      .populate('floor')
      .populate('lastUpdatedBy', 'name email')
      .lean(),
    ServiceStatus.countDocuments(safeFilter(filter)),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = await enrichWithComplaintCounts(data as any[]);

  return c.json({
    success: true,
    data: enriched,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /services/floor/:floorId/with-complaints ──
services.get('/floor/:floorId/with-complaints', authGuard, async (c) => {
  const floorId = parseId(c.req.param('floorId'));
  if (!floorId) return badRequest(c, 'Invalid floor ID');

  const services_list = await ServiceStatus.find(safeFilter({ floorId }))
    .populate('floor')
    .populate('lastUpdatedBy', 'name email')
    .lean();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = await enrichWithComplaintCounts(services_list as any[]);
  const totalRooms = await Room.countDocuments(safeFilter({ floorId, isActive: true }));

  return c.json({
    success: true,
    data: {
      services: enriched,
      totalRooms,
    },
  });
});

// ── POST /services — create service status entry (admin) ──
services.post(
  '/',
  authGuard,
  adminOnly,
  zValidator(
    'json',
    z.strictObject({
      floorId: z.string().min(1, 'Floor is required'),
      serviceType: z.string().min(1, 'Service type is required'),
      status: z.enum(['operational', 'degraded', 'down']).default('operational'),
      note: z.string().max(500).optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json');
    const user = c.get('user');

    const validType = await isValidFloorServiceType(body.serviceType);
    if (!validType) {
      return badRequest(
        c,
        'Invalid service type. Must match an isPerFloor AppConfig amenity definition key.',
        'INVALID_SERVICE_TYPE',
      );
    }

    const { Floor } = await import('../models/floor.js');
    const floor = await Floor.findById(body.floorId).lean();
    if (!floor) {
      return c.json(
        { success: false, error: { code: 'FLOOR_NOT_FOUND', message: 'Floor not found' } },
        400,
      );
    }

    try {
      const service = await ServiceStatus.create({
        floorId: new mongoose.Types.ObjectId(body.floorId),
        serviceType: body.serviceType,
        status: body.status,
        note: body.note ?? '',
        lastUpdatedBy: new mongoose.Types.ObjectId(user.sub),
        lastUpdatedAt: new Date(),
      } as Record<string, unknown>);
      const createdId = String((service as { _id?: unknown })._id ?? '');
      const populated = await ServiceStatus.findById(createdId)
        .populate('floor')
        .populate('lastUpdatedBy', 'name email')
        .lean();

      await writeAuditLog({
        userId: user.sub,
        action: 'create',
        resource: 'service',
        resourceId: createdId,
        details: {
          floorId: body.floorId,
          serviceType: body.serviceType,
          status: body.status,
          note: body.note,
        },
      });

      broadcast({
        event: 'service_update',
        data: populated,
        timestamp: new Date().toISOString(),
      });

      return c.json({ success: true, data: populated }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create service status';
      if (message.includes('duplicate') || (err as { code?: number })?.code === 11000) {
        // conflict() throws AppError for globalErrorHandler (do not nest badRequest in catch)
        return conflict(c, 'Service status already exists for this floor and type');
      }
      return badRequest(c, message);
    }
  },
);

// ── PUT /services/:id — update service status (auth) ──
services.put('/:id', authGuard, zValidator('json', updateServiceSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid service ID');

  const body = c.req.valid('json');
  const user = c.get('user');

  const service = await ServiceStatus.findById(id);
  if (!service) return notFound(c, 'ServiceStatus');

  // Non-admin reporters may only flag their own floor (guardians cannot report).
  if (user.role !== 'admin') {
    if (user.role !== 'tenant') {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only admins or tenants can report services.' },
        },
        403,
      );
    }
    const tenantDoc = await Tenant.findOne(safeFilter({ userId: user.sub, isActive: true })).lean();
    const roomDoc = tenantDoc
      ? await Room.findById((tenantDoc as unknown as Record<string, unknown>).roomId)
          .select('floorId')
          .lean()
      : null;
    const ownFloorId = roomDoc
      ? String((roomDoc as unknown as Record<string, unknown>).floorId)
      : '';
    if (!ownFloorId || ownFloorId !== String(service.floorId)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only report services on your own floor.' },
        },
        403,
      );
    }
    if (body.status === 'operational') {
      return badRequest(
        c,
        'Only administrators can set a service status to operational. Tenants may only report degraded or down.',
        'PERMISSION_DENIED',
      );
    }
  }

  const previousStatus = service.status;
  const previousNote = service.note;
  service.status = body.status;
  service.lastUpdatedBy = user.sub as unknown as typeof service.lastUpdatedBy;
  service.lastUpdatedAt = new Date();
  if (body.note !== undefined) {
    service.note = body.note;
  }
  await service.save();

  if (previousStatus !== body.status || previousNote !== service.note) {
    await writeAuditLog({
      userId: user.sub,
      action: 'update',
      resource: 'service',
      resourceId: id,
      details: {
        previousStatus,
        status: body.status,
        noteChanged: previousNote !== service.note,
        serviceType: service.serviceType,
        floorId: String(service.floorId ?? ''),
      },
    });
  }

  const populated = await ServiceStatus.findById(id)
    .populate('floor')
    .populate('lastUpdatedBy', 'name email')
    .lean();

  broadcast({
    event: 'service_update',
    data: populated,
    timestamp: new Date().toISOString(),
  });

  return c.json({ success: true, data: populated });
});

// ── GET /services/:id — single service status with complaint count ──
services.get('/:id', authGuard, async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid service ID');

  const service = await ServiceStatus.findById(id)
    .populate('floor')
    .populate('lastUpdatedBy', 'name email')
    .lean();
  if (!service) return notFound(c, 'ServiceStatus');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = await enrichWithComplaintCounts([service as any]);
  return c.json({ success: true, data: enriched[0] });
});

// ── PUT /services/:id/full — full update (admin) ──
services.put(
  '/:id/full',
  authGuard,
  adminOnly,
  zValidator(
    'json',
    z.strictObject({
      serviceType: z.string().min(1).optional(),
      status: z.enum(['operational', 'degraded', 'down']).optional(),
      note: z.string().max(500).optional(),
    }),
  ),
  async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return badRequest(c, 'Invalid service ID');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = c.req.valid('json') as any;

    if (body.serviceType) {
      const validType = await isValidFloorServiceType(body.serviceType);
      if (!validType) {
        return badRequest(
          c,
          'Invalid service type. Must match an isPerFloor AppConfig amenity definition key.',
          'INVALID_SERVICE_TYPE',
        );
      }
    }

    const service = await ServiceStatus.findById(id);
    if (!service) return notFound(c, 'Service');

    // ── Duplicate check: floorId + serviceType ──
    if (body.serviceType !== undefined) {
      const exists = await ServiceStatus.findOne(
        safeFilter({
          floorId: service.floorId,
          serviceType: body.serviceType,
          _id: { $ne: service._id },
        }),
      );
      if (exists) {
        return c.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_SERVICE',
              message: 'A service status entry already exists for this floor and service type.',
            },
          },
          409,
        );
      }
    }

    const previousStatus = service.status;
    if (body.serviceType !== undefined) service.serviceType = body.serviceType;
    if (body.status !== undefined) service.status = body.status;
    if (body.note !== undefined) service.note = body.note;
    await service.save();

    const user = c.get('user');
    await writeAuditLog({
      userId: user.sub,
      action: 'update',
      resource: 'service',
      resourceId: id,
      details: {
        previousStatus,
        status: service.status,
        serviceType: service.serviceType,
        note: service.note,
        source: 'full',
      },
    });

    const populated = await ServiceStatus.findById(service._id)
      .populate('floor')
      .populate('lastUpdatedBy', 'name email')
      .lean();

    broadcast({
      event: 'service_update',
      data: populated,
      timestamp: new Date().toISOString(),
    });

    return c.json({ success: true, data: populated });
  },
);

// ── DELETE /services/:id — delete service (admin) ──
services.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = c.req.param('id');
  if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(c, 'Invalid service ID');
  const service = await ServiceStatus.findByIdAndDelete(id);
  if (!service) return notFound(c, 'Service');

  const user = c.get('user');
  await writeAuditLog({
    userId: user.sub,
    action: 'delete',
    resource: 'service',
    resourceId: id,
    details: {
      serviceType: service.serviceType,
      floorId: String(service.floorId ?? ''),
    },
  });

  broadcast({
    event: 'service_update',
    data: { id, deleted: true },
    timestamp: new Date().toISOString(),
  });

  return c.json({ success: true, data: { message: 'Service deleted' } });
});

export default services;
