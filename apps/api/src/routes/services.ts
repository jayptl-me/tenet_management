import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authGuard } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roles.js';
import { notFound, badRequest, parseId, parsePagination, safeFilter } from '../lib/routeUtils.js';
import { ServiceStatus } from '../models/serviceStatus.js';

const services = new Hono();

// ── Schema ──────────────────────────────────────────────
const updateServiceSchema = z.strictObject({
  status: z.enum(['operational', 'degraded', 'down']),
  note: z.string().max(500, 'Note cannot exceed 500 characters').optional(),
});

// ── PUT /services/:id ───────────────────────────────────
services.put('/:id', authGuard, zValidator('json', updateServiceSchema), async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return badRequest(c, 'Invalid service ID');

  const body = c.req.valid('json');
  const user = c.get('user');

  const service = await ServiceStatus.findById(id);
  if (!service) return notFound(c, 'ServiceStatus');

  // Tenant (non-admin) can only set to degraded or down
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

// ── GET /services/summary ───────────────────────────────
services.get('/summary', authGuard, adminOnly, async (_c) => {
  const results = await ServiceStatus.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const summary: Record<string, number> = { operational: 0, degraded: 0, down: 0 };
  for (const entry of results) {
    summary[entry._id as string] = entry.count;
  }

  return _c.json({ success: true, data: summary });
});

// ── GET /services ───────────────────────────────────────
services.get('/', authGuard, async (c) => {
  const filter: Record<string, unknown> = {};

  const floorIdQ = c.req.query('floorId');
  if (floorIdQ) {
    const parsed = parseId(floorIdQ);
    if (!parsed) return badRequest(c, 'Invalid floorId');
    filter.floorId = parsed;
  }

  const pagination = parsePagination(c);
  const { skip, limit, page } = pagination;

  const [data, total] = await Promise.all([
    ServiceStatus.find(safeFilter(filter))
      .sort({ floorId: 1, serviceType: 1 } as Record<string, 1>)
      .skip(skip)
      .limit(limit)
      .populate('floor')
      .lean(),
    ServiceStatus.countDocuments(safeFilter(filter)),
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

export default services;
