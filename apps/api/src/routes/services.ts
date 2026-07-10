import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import mongoose from 'mongoose';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, safeFilter } from '../lib/routeUtils.js';
import { ServiceStatus } from '../models/serviceStatus.js';
import { Complaint } from '../models/complaint.js';
import { Room } from '../models/room.js';
import { AppConfig } from '../models/appConfig.js';

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

// ── Helper: validate serviceType against AppConfig definitions ──
async function isValidServiceType(serviceType: string): Promise<boolean> {
  const config = await AppConfig.findOne().select('amenityDefinitions').lean();
  const definitions = config?.amenityDefinitions ?? [];
  return definitions.some((d) => d.key === serviceType);
}

// ── Helper: attach complaint counts per service per floor (dynamic) ──
async function enrichWithComplaintCounts(
  services_list: Array<{
    floorId?: { _id: string } | string;
    serviceType: string;
    [key: string]: unknown;
  }>,
): Promise<Array<Record<string, unknown>>> {
  if (services_list.length === 0) return services_list;

  const serviceToCategory = await getAmenityComplaintMap();

  const enriched = await Promise.all(
    services_list.map(async (svc) => {
      const floorId =
        typeof svc.floorId === 'object' && svc.floorId?._id
          ? String(svc.floorId._id)
          : typeof svc.floorId === 'string'
            ? svc.floorId
            : null;

      if (!floorId) {
        return { ...svc, openComplaintCount: 0 };
      }

      const categories = serviceToCategory[svc.serviceType] ?? [svc.serviceType];

      const roomIds = await Room.find({ floorId: new mongoose.Types.ObjectId(floorId) } as Record<
        string,
        unknown
      >).distinct('_id');
      const floorComplaintCount = await Complaint.countDocuments({
        status: { $in: ['open', 'in_progress'] },
        category: { $in: categories },
        roomId: { $in: roomIds },
      } as Record<string, unknown>);

      return { ...svc, openComplaintCount: floorComplaintCount };
    }),
  );

  return enriched;
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

  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    ServiceStatus.find(safeFilter(filter))
      .sort({ serviceType: 1 } as Record<string, 1>)
      .skip(skip)
      .limit(limit)
      .populate('floor')
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

  const services_list = await ServiceStatus.find(safeFilter({ floorId })).populate('floor').lean();

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

    const validType = await isValidServiceType(body.serviceType);
    if (!validType) {
      return badRequest(
        c,
        'Invalid service type. Must match an AppConfig amenity definition key.',
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
      const populated = await ServiceStatus.findById(createdId).populate('floor').lean();
      return c.json({ success: true, data: populated }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create service status';
      if (message.includes('duplicate') || (err as { code?: number })?.code === 11000) {
        return badRequest(
          c,
          'Service status already exists for this floor and type',
          'DUPLICATE_SERVICE',
        );
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

  if (user.role !== 'admin') {
    if (body.status === 'operational') {
      return badRequest(
        c,
        'Only administrators can set a service status to operational. Tenants may only report degraded or down.',
        'PERMISSION_DENIED',
      );
    }
  }

  service.status = body.status;
  service.lastUpdatedBy = user.sub as unknown as typeof service.lastUpdatedBy;
  service.lastUpdatedAt = new Date();
  if (body.note !== undefined) {
    service.note = body.note;
  }
  await service.save();

  return c.json({ success: true, data: service });
});

// ── GET /services/:id — single service status with complaint count ──
services.get('/:id', authGuard, async (c) => {
  const id = c.req.param('id');
  if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(c, 'Invalid service ID');

  const service = await ServiceStatus.findById(id).populate('floor').lean();
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
    const id = c.req.param('id');
    if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(c, 'Invalid service ID');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = c.req.valid('json') as any;

    if (body.serviceType) {
      const validType = await isValidServiceType(body.serviceType);
      if (!validType) {
        return badRequest(
          c,
          'Invalid service type. Must match an AppConfig amenity definition key.',
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

    if (body.serviceType !== undefined) service.serviceType = body.serviceType;
    if (body.status !== undefined) service.status = body.status;
    if (body.note !== undefined) service.note = body.note;
    await service.save();

    const populated = await ServiceStatus.findById(service._id).populate('floor').lean();
    return c.json({ success: true, data: populated });
  },
);

// ── DELETE /services/:id — delete service (admin) ──
services.delete('/:id', authGuard, adminOnly, async (c) => {
  const id = c.req.param('id');
  if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(c, 'Invalid service ID');
  const service = await ServiceStatus.findByIdAndDelete(id);
  if (!service) return notFound(c, 'Service');
  return c.json({ success: true, data: { message: 'Service deleted' } });
});

export default services;
